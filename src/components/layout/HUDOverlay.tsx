import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAmbientAudio, type AmbientTrack } from '@/hooks/useAmbientAudio';

/* ══════════════════════════════════════════════════════════════ */
/*  DEEP-WORK HUD OVERLAY                                        */
/*  - Toggle to enter "In The Zone" focus mode                   */
/*  - High-contrast countdown timer — centered on all screens    */
/*  - Broadcasts focus status to peers via presence system       */
/*  - Mobile-first: responsive sizing, touch-friendly controls   */
/*  - PERSISTS across page refresh via localStorage              */
/*  - Ambient audio: brown noise / alpha waves with volume ctrl  */
/*  - Waveform visualizer + play/pause toggle                    */
/* ══════════════════════════════════════════════════════════════ */

const FOCUS_DURATIONS = [
  { label: '25m', seconds: 25 * 60, tag: 'POMODORO' },
  { label: '50m', seconds: 50 * 60, tag: 'DEEP WORK' },
  { label: '90m', seconds: 90 * 60, tag: 'FLOW STATE' },
  { label: '∞', seconds: 0, tag: 'OPEN SESSION' },
];

const FOCUS_KEY = 'vive-deep-work-state';

interface DeepWorkState {
  active: boolean;
  startedAt: number;
  durationSeconds: number;
  durationLabel: string;
}

function loadState(): DeepWorkState | null {
  try {
    const raw = localStorage.getItem(FOCUS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as DeepWorkState;
    if (!s.active) return null;
    if (s.durationSeconds > 0) {
      const elapsed = (Date.now() - s.startedAt) / 1000;
      if (elapsed >= s.durationSeconds) {
        localStorage.removeItem(FOCUS_KEY);
        return null;
      }
    }
    return s;
  } catch {
    return null;
  }
}

function computeInitialElapsed(s: DeepWorkState | null): number {
  if (!s || !s.active) return 0;
  return Math.max(0, (Date.now() - s.startedAt) / 1000);
}

function saveState(s: DeepWorkState | null) {
  try {
    if (!s) localStorage.removeItem(FOCUS_KEY);
    else localStorage.setItem(FOCUS_KEY, JSON.stringify(s));
  } catch { /* no-op */ }
}

// ── Global focus mode state for presence broadcasting ──
let _deepWorkActive = false;
const _deepWorkListeners = new Set<(active: boolean) => void>();

export function getDeepWorkActive() { return _deepWorkActive; }

export function isDeepWorkPersistedActive(): boolean {
  return loadState() !== null;
}

export function onDeepWorkChange(fn: (active: boolean) => void) {
  _deepWorkListeners.add(fn);
  return () => { _deepWorkListeners.delete(fn); };
}

function setDeepWorkGlobal(active: boolean) {
  _deepWorkActive = active;
  _deepWorkListeners.forEach(fn => fn(active));
}

interface HUDOverlayProps {
  onFocusChange?: (active: boolean) => void;
}

/* ── Audio Track Labels ── */
const TRACK_OPTIONS: { id: AmbientTrack; label: string; icon: string; desc: string }[] = [
  { id: 'brown-noise', label: 'Brown Noise', icon: '🌊', desc: 'Deep low-frequency warmth' },
  { id: 'alpha-waves', label: 'Alpha Waves', icon: '🧠', desc: '10Hz binaural focus tone' },
];

/* ── Mini Waveform Visualizer ── */
function WaveformVisualizer({ getWaveform, isPlaying, color }: { getWaveform: () => Uint8Array | null; isPlaying: boolean; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const barsRef = useRef<number[]>(Array(16).fill(2));

  useEffect(() => {
    if (!isPlaying) {
      // Animate bars to zero
      barsRef.current = barsRef.current.map(() => 2);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const barW = canvas.width / 16;
          for (let i = 0; i < 16; i++) {
            ctx.fillStyle = `${color}33`;
            const h = 2;
            ctx.fillRect(i * barW + 1, canvas.height - h, barW - 2, h);
          }
        }
      }
      return;
    }

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const waveform = getWaveform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 16;
      const barW = canvas.width / barCount;
      const maxH = canvas.height;

      for (let i = 0; i < barCount; i++) {
        const dataIdx = Math.floor((i / barCount) * (waveform?.length || 32));
        const raw = waveform ? waveform[dataIdx] / 255 : 0;
        // Smooth with previous value
        const target = Math.max(2, raw * maxH * 0.85);
        barsRef.current[i] += (target - barsRef.current[i]) * 0.3;
        const h = barsRef.current[i];

        // Gradient per bar
        const grad = ctx.createLinearGradient(0, maxH - h, 0, maxH);
        grad.addColorStop(0, color);
        grad.addColorStop(1, `${color}44`);
        ctx.fillStyle = grad;

        const x = i * barW + 1;
        const radius = 1.5;
        const w = barW - 2;
        const y = maxH - h;

        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, maxH);
        ctx.lineTo(x, maxH);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, getWaveform, color]);

  return (
    <canvas
      ref={canvasRef}
      width={160}
      height={32}
      style={{ width: '100%', height: 32, borderRadius: 6, opacity: isPlaying ? 1 : 0.3, transition: 'opacity 0.3s' }}
    />
  );
}

export default function HUDOverlay({ onFocusChange }: HUDOverlayProps) {
  const [state, setState] = useState<DeepWorkState | null>(() => loadState());
  const [showPicker, setShowPicker] = useState(false);
  const [elapsed, setElapsed] = useState(() => computeInitialElapsed(loadState()));
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const isActive = !!state?.active;

  // Ambient audio — auto fades in/out with Deep Work state
  const audio = useAmbientAudio(isActive);

  useEffect(() => {
    onFocusChange?.(isActive);
    setDeepWorkGlobal(isActive);
  }, [isActive, onFocusChange]);

  // Close audio panel when Deep Work ends
  useEffect(() => {
    if (!isActive) setShowAudioPanel(false);
  }, [isActive]);

  useEffect(() => {
    if (!isActive || !state) return;

    const tick = () => {
      const e = (Date.now() - state.startedAt) / 1000;
      setElapsed(e);
      if (state.durationSeconds > 0 && e >= state.durationSeconds) {
        setState(null);
        saveState(null);
        setElapsed(0);
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state]);

  const startSession = useCallback((duration: typeof FOCUS_DURATIONS[number]) => {
    const s: DeepWorkState = {
      active: true,
      startedAt: Date.now(),
      durationSeconds: duration.seconds,
      durationLabel: duration.tag,
    };
    setState(s);
    saveState(s);
    setElapsed(0);
    setShowPicker(false);
  }, []);

  const endSession = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState(null);
    saveState(null);
    setElapsed(0);
  }, []);

  const togglePicker = useCallback(() => {
    if (isActive) {
      endSession();
    } else {
      setShowPicker(p => !p);
    }
  }, [isActive, endSession]);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: TouchEvent | MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.hud-picker') && !target.closest('.hud-toggle')) {
        setShowPicker(false);
      }
    };
    document.addEventListener('touchstart', handler, { passive: true });
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('mousedown', handler);
    };
  }, [showPicker]);

  // Close audio panel on outside tap
  useEffect(() => {
    if (!showAudioPanel) return;
    const handler = (e: TouchEvent | MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.hud-audio-panel') && !target.closest('.hud-audio-toggle')) {
        setShowAudioPanel(false);
      }
    };
    document.addEventListener('touchstart', handler, { passive: true });
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('mousedown', handler);
    };
  }, [showAudioPanel]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const remaining = state?.durationSeconds
    ? Math.max(0, state.durationSeconds - elapsed)
    : elapsed;

  const progress = state?.durationSeconds
    ? Math.min(1, elapsed / state.durationSeconds)
    : 0;

  const volumePercent = Math.round(audio.volume * 100);
  const activeTrackOption = TRACK_OPTIONS.find(t => t.id === audio.track) || TRACK_OPTIONS[0];

  return (
    <>
      {/* ── Toggle Button (always visible) ── */}
      <motion.button
        onClick={togglePicker}
        className="hud-toggle"
        style={{
          position: 'fixed',
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          top: 14,
          left: 14,
          padding: isActive ? '6px 14px' : '6px 10px',
          borderRadius: 10,
          background: isActive
            ? 'linear-gradient(135deg, rgba(255,140,50,0.15) 0%, rgba(255,80,20,0.08) 100%)'
            : 'rgba(20,20,20,0.9)',
          border: `1px solid ${isActive ? 'rgba(255,140,50,0.4)' : 'rgba(255,255,255,0.06)'}`,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: isActive
            ? '0 0 24px rgba(255,140,50,0.15), 0 2px 8px rgba(0,0,0,0.4)'
            : '0 2px 8px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          minHeight: 36,
          minWidth: 36,
        }}
        whileTap={{ scale: 0.95 }}
      >
        <div style={{ position: 'relative', width: 18, height: 18 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke={isActive ? '#FF8C32' : 'rgba(255,255,255,0.3)'} strokeWidth="1.5" />
            <circle cx="12" cy="12" r="6" stroke={isActive ? '#FF8C32' : 'rgba(255,255,255,0.2)'} strokeWidth="1" />
            <circle cx="12" cy="12" r="2" fill={isActive ? '#FF8C32' : 'rgba(255,255,255,0.15)'} />
          </svg>
          {isActive && (
            <motion.div
              style={{
                position: 'absolute', inset: -3,
                borderRadius: '50%',
                border: '1.5px solid rgba(255,140,50,0.4)',
              }}
              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>

        {isActive ? (
          <span className="hud-toggle-time" style={{
            fontFamily: 'monospace',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#FF8C32',
            textShadow: '0 0 8px rgba(255,140,50,0.4)',
          }}>
            {state?.durationSeconds ? formatTime(remaining) : formatTime(elapsed)}
          </span>
        ) : (
          <span style={{
            fontFamily: 'monospace',
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.35)',
            textTransform: 'uppercase',
          }}>
            Focus
          </span>
        )}
      </motion.button>

      {/* ── Audio Control Button (only when Deep Work active) ── */}
      <AnimatePresence>
        {isActive && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, x: 20 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8, x: 20 }}
            transition={{ duration: 0.35, delay: 0.15, ease: [0.4, 0, 0.2, 1] }}
            onClick={() => setShowAudioPanel(p => !p)}
            className="hud-audio-toggle"
            style={{
              position: 'fixed',
              zIndex: 9998,
              top: 14,
              right: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 10,
              background: audio.isPlaying
                ? 'linear-gradient(135deg, rgba(255,140,50,0.12) 0%, rgba(255,100,30,0.06) 100%)'
                : audio.isPaused
                  ? 'rgba(20,20,20,0.9)'
                  : 'rgba(20,20,20,0.9)',
              border: `1px solid ${audio.isPlaying ? 'rgba(255,140,50,0.25)' : 'rgba(255,255,255,0.06)'}`,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: audio.isPlaying
                ? '0 0 16px rgba(255,140,50,0.1), 0 2px 8px rgba(0,0,0,0.3)'
                : '0 2px 8px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              minHeight: 36,
            }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Speaker icon */}
            <div style={{ position: 'relative', width: 16, height: 16 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 5L6 9H2v6h4l5 4V5z" stroke={audio.isPlaying ? '#FF8C32' : audio.isPaused ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)'} fill={audio.isPlaying ? 'rgba(255,140,50,0.15)' : 'none'} />
                {audio.isPlaying && (
                  <>
                    <motion.path
                      d="M15.54 8.46a5 5 0 010 7.07"
                      stroke="rgba(255,140,50,0.5)"
                      animate={{ opacity: [0.3, 0.7, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.path
                      d="M19.07 4.93a10 10 0 010 14.14"
                      stroke="rgba(255,140,50,0.3)"
                      animate={{ opacity: [0.15, 0.4, 0.15] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                    />
                  </>
                )}
                {!audio.isPlaying && (
                  <path d="M23 9l-6 6M17 9l6 6" stroke="rgba(255,255,255,0.2)" />
                )}
              </svg>
            </div>

            {/* Mini equalizer bars in button */}
            {audio.isPlaying && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 10 }}>
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    style={{
                      width: 2,
                      borderRadius: 1,
                      background: 'rgba(255,140,50,0.5)',
                    }}
                    animate={{
                      height: [2, 6 + i * 2, 3, 8 - i, 2],
                    }}
                    transition={{
                      duration: 1 + i * 0.2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.12,
                    }}
                  />
                ))}
              </div>
            )}

            <span style={{
              fontFamily: 'monospace',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.08em',
              color: audio.isPlaying ? 'rgba(255,140,50,0.7)' : audio.isPaused ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)',
              textTransform: 'uppercase',
            }}>
              {audio.isPaused ? 'Off' : `${volumePercent}%`}
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Audio Control Panel (glassmorphism dropdown) ── */}
      <AnimatePresence>
        {showAudioPanel && isActive && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.92 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="hud-audio-panel"
            style={{
              position: 'fixed',
              zIndex: 9999,
              top: 56,
              right: 14,
              background: 'rgba(10, 10, 12, 0.82)',
              border: '1px solid rgba(255,140,50,0.12)',
              borderRadius: 16,
              padding: '16px',
              backdropFilter: 'blur(40px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(40px) saturate(1.6)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 60px rgba(255,140,50,0.04)',
              width: 240,
              pointerEvents: 'auto',
            }}
          >
            {/* Panel header with play/pause */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}>
              <div style={{
                fontFamily: 'monospace',
                fontSize: 8,
                fontWeight: 600,
                letterSpacing: '0.15em',
                color: 'rgba(255,140,50,0.5)',
                textTransform: 'uppercase',
              }}>
                Ambient Audio
              </div>

              {/* Play / Pause toggle */}
              <motion.button
                onClick={() => audio.togglePause()}
                whileTap={{ scale: 0.9 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: audio.isPlaying
                    ? 'rgba(255,140,50,0.12)'
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${audio.isPlaying ? 'rgba(255,140,50,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                {audio.isPlaying ? (
                  /* Pause icon */
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="6" y="4" width="4" height="16" rx="1" fill="#FF8C32" />
                    <rect x="14" y="4" width="4" height="16" rx="1" fill="#FF8C32" />
                  </svg>
                ) : (
                  /* Play icon */
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M8 5v14l11-7L8 5z" fill="rgba(255,255,255,0.4)" />
                  </svg>
                )}
              </motion.button>
            </div>

            {/* Waveform visualizer */}
            <div style={{
              marginBottom: 14,
              padding: '6px 4px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.03)',
            }}>
              <WaveformVisualizer
                getWaveform={audio.getWaveform}
                isPlaying={audio.isPlaying}
                color="#FF8C32"
              />
            </div>

            {/* Track selector */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {TRACK_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => audio.setTrack(t.id)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '10px 6px 8px',
                    borderRadius: 12,
                    background: audio.track === t.id
                      ? 'linear-gradient(135deg, rgba(255,140,50,0.1) 0%, rgba(255,100,30,0.05) 100%)'
                      : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${audio.track === t.id ? 'rgba(255,140,50,0.25)' : 'rgba(255,255,255,0.04)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {/* Active glow */}
                  {audio.track === t.id && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '60%',
                      height: 1,
                      background: 'linear-gradient(90deg, transparent, rgba(255,140,50,0.5), transparent)',
                    }} />
                  )}
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: 8,
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    color: audio.track === t.id ? '#FF8C32' : 'rgba(255,255,255,0.35)',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}>
                    {t.label}
                  </span>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: 7,
                    fontWeight: 400,
                    color: audio.track === t.id ? 'rgba(255,140,50,0.45)' : 'rgba(255,255,255,0.15)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}>
                    {t.desc}
                  </span>
                </button>
              ))}
            </div>

            {/* Volume slider */}
            <div style={{ marginBottom: 4 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: 8,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  color: 'rgba(255,255,255,0.3)',
                  textTransform: 'uppercase',
                }}>
                  Volume
                </span>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  fontWeight: 700,
                  color: audio.isPaused ? 'rgba(255,255,255,0.2)' : '#FF8C32',
                  minWidth: 32,
                  textAlign: 'right',
                  transition: 'color 0.2s',
                }}>
                  {audio.isPaused ? '—' : `${volumePercent}%`}
                </span>
              </div>

              {/* Custom slider track */}
              <div style={{
                position: 'relative',
                height: 28,
                display: 'flex',
                alignItems: 'center',
                opacity: audio.isPaused ? 0.35 : 1,
                transition: 'opacity 0.3s',
              }}>
                <div style={{
                  position: 'absolute',
                  left: 0, right: 0,
                  height: 4,
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                }}>
                  <motion.div
                    style={{
                      height: '100%',
                      borderRadius: 2,
                      background: 'linear-gradient(90deg, rgba(255,140,50,0.5), #FF8C32)',
                      boxShadow: '0 0 8px rgba(255,140,50,0.25)',
                    }}
                    animate={{ width: `${volumePercent}%` }}
                    transition={{ duration: 0.1, ease: 'linear' }}
                  />
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volumePercent}
                  onChange={(e) => audio.setVolume(parseInt(e.target.value) / 100)}
                  disabled={audio.isPaused}
                  style={{
                    position: 'absolute',
                    left: 0, right: 0,
                    width: '100%',
                    height: 28,
                    opacity: 0,
                    cursor: audio.isPaused ? 'not-allowed' : 'pointer',
                    margin: 0,
                    zIndex: 2,
                  }}
                />

                <motion.div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: '#FF8C32',
                    boxShadow: '0 0 10px rgba(255,140,50,0.4), 0 2px 4px rgba(0,0,0,0.4)',
                    border: '2px solid rgba(255,200,150,0.25)',
                    pointerEvents: 'none',
                    transform: 'translateY(-50%)',
                  }}
                  animate={{
                    left: `calc(${volumePercent}% - 7px)`,
                  }}
                  transition={{ duration: 0.1, ease: 'linear' }}
                />
              </div>
            </div>

            {/* Quick volume presets */}
            <div style={{
              display: 'flex',
              gap: 4,
              marginTop: 8,
              opacity: audio.isPaused ? 0.35 : 1,
              transition: 'opacity 0.3s',
            }}>
              {[10, 30, 50, 75].map((v) => (
                <button
                  key={v}
                  onClick={() => !audio.isPaused && audio.setVolume(v / 100)}
                  disabled={audio.isPaused}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    borderRadius: 6,
                    background: volumePercent === v && !audio.isPaused ? 'rgba(255,140,50,0.12)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${volumePercent === v && !audio.isPaused ? 'rgba(255,140,50,0.25)' : 'rgba(255,255,255,0.04)'}`,
                    cursor: audio.isPaused ? 'not-allowed' : 'pointer',
                    fontFamily: 'monospace',
                    fontSize: 9,
                    fontWeight: 600,
                    color: volumePercent === v && !audio.isPaused ? '#FF8C32' : 'rgba(255,255,255,0.25)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {v}%
                </button>
              ))}
            </div>

            {/* Audio status footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid rgba(255,255,255,0.04)',
            }}>
              <motion.div
                style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: audio.isPlaying ? '#FF8C32' : audio.isPaused ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.15)',
                  flexShrink: 0,
                  boxShadow: audio.isPlaying ? '0 0 6px rgba(255,140,50,0.4)' : 'none',
                }}
                animate={audio.isPlaying ? { opacity: [1, 0.4, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span style={{
                fontFamily: 'monospace',
                fontSize: 8,
                fontWeight: 500,
                letterSpacing: '0.08em',
                color: audio.isPlaying ? 'rgba(255,140,50,0.5)' : 'rgba(255,255,255,0.2)',
              }}>
                {audio.isPlaying
                  ? `${activeTrackOption.icon} ${activeTrackOption.label} · Playing`
                  : audio.isPaused
                    ? 'Audio paused'
                    : 'Starting...'
                }
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Duration Picker Dropdown ── */}
      <AnimatePresence>
        {showPicker && !isActive && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="hud-picker"
            style={{
              position: 'fixed',
              zIndex: 9999,
              top: 56,
              left: 14,
              background: 'rgba(12,12,16,0.96)',
              border: '1px solid rgba(255,140,50,0.15)',
              borderRadius: 14,
              padding: 6,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 40px rgba(255,140,50,0.05)',
              minWidth: 180,
            }}
          >
            <div style={{
              padding: '6px 10px 8px',
              fontFamily: 'monospace',
              fontSize: 8,
              fontWeight: 600,
              letterSpacing: '0.15em',
              color: 'rgba(255,140,50,0.5)',
              textTransform: 'uppercase',
            }}>
              Enter Deep Work
            </div>
            {FOCUS_DURATIONS.map((d) => (
              <button
                key={d.label}
                onClick={() => startSession(d)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '12px 12px',
                  borderRadius: 10,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  fontFamily: 'monospace',
                  minHeight: 44,
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'rgba(255,140,50,0.08)'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: '#FF8C32',
                    minWidth: 36,
                    textAlign: 'left',
                  }}>
                    {d.label}
                  </span>
                  <span style={{
                    fontSize: 9,
                    fontWeight: 500,
                    letterSpacing: '0.08em',
                    color: 'rgba(255,255,255,0.35)',
                    textTransform: 'uppercase',
                  }}>
                    {d.tag}
                  </span>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,140,50,0.3)" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Full-screen Focus HUD (when active) ── */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            className="deep-work-hud"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9990,
              pointerEvents: 'none',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Top progress bar */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 3,
              background: 'rgba(255,140,50,0.08)',
            }}>
              {state?.durationSeconds ? (
                <motion.div
                  style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #FF8C32, #FF6B20)',
                    boxShadow: '0 0 12px rgba(255,140,50,0.5)',
                    borderRadius: '0 2px 2px 0',
                  }}
                  initial={{ width: `${progress * 100}%` }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.5, ease: 'linear' }}
                />
              ) : (
                <motion.div
                  style={{
                    height: '100%',
                    width: '30%',
                    background: 'linear-gradient(90deg, transparent, #FF8C32, transparent)',
                    boxShadow: '0 0 12px rgba(255,140,50,0.3)',
                  }}
                  animate={{ x: ['-30%', '330%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
            </div>

            {/* Session label — centered at top */}
            <div className="hud-session-label" style={{
              position: 'absolute',
              top: 48,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 14px',
              borderRadius: 20,
              background: 'rgba(255,140,50,0.06)',
              border: '1px solid rgba(255,140,50,0.12)',
              whiteSpace: 'nowrap',
              maxWidth: 'calc(100vw - 32px)',
            }}>
              <motion.div
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#FF8C32',
                  boxShadow: '0 0 8px rgba(255,140,50,0.6)',
                  flexShrink: 0,
                }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span style={{
                fontFamily: 'monospace',
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: '0.15em',
                color: '#FF8C32',
                textTransform: 'uppercase',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {state?.durationLabel || 'DEEP WORK'} — In The Zone
              </span>
            </div>

            {/* ── CENTERED COUNTDOWN TIMER ── */}
            <div className="hud-center-timer" style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}>
              <div className="hud-countdown" style={{
                fontFamily: 'monospace',
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: '#FF8C32',
                textShadow: '0 0 40px rgba(255,140,50,0.25), 0 0 80px rgba(255,140,50,0.1)',
                lineHeight: 1,
                textAlign: 'center',
                fontSize: 'clamp(48px, 12vw, 72px)',
              }}>
                {state?.durationSeconds ? formatTime(remaining) : formatTime(elapsed)}
              </div>

              <div style={{
                fontFamily: 'monospace',
                fontSize: 'clamp(8px, 2vw, 10px)',
                fontWeight: 600,
                letterSpacing: '0.2em',
                color: 'rgba(255,140,50,0.35)',
                textTransform: 'uppercase',
                textAlign: 'center',
              }}>
                {state?.durationSeconds ? 'remaining' : 'elapsed'}
              </div>

              {state?.durationSeconds ? (
                <svg
                  className="hud-progress-ring"
                  viewBox="0 0 120 120"
                  style={{
                    position: 'absolute',
                    width: 'clamp(140px, 35vw, 200px)',
                    height: 'clamp(140px, 35vw, 200px)',
                    opacity: 0.2,
                  }}
                >
                  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,140,50,0.15)" strokeWidth="2" />
                  <circle
                    cx="60" cy="60" r="54" fill="none" stroke="#FF8C32" strokeWidth="2" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 54}`}
                    strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress)}`}
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dashoffset 0.5s linear' }}
                  />
                </svg>
              ) : null}

              {/* Audio playing indicator below timer */}
              {audio.isPlaying && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 12 }}>
                    {[0, 1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        style={{
                          width: 2,
                          borderRadius: 1,
                          background: 'rgba(255,140,50,0.4)',
                        }}
                        animate={{
                          height: [3, 8 + i * 2, 4, 10 - i, 3],
                        }}
                        transition={{
                          duration: 1.2 + i * 0.2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                          delay: i * 0.15,
                        }}
                      />
                    ))}
                  </div>
                  <span style={{
                    fontFamily: 'monospace',
                    fontSize: 8,
                    fontWeight: 500,
                    letterSpacing: '0.1em',
                    color: 'rgba(255,140,50,0.3)',
                    textTransform: 'uppercase',
                  }}>
                    {activeTrackOption.icon} {activeTrackOption.label}
                  </span>
                </motion.div>
              )}
            </div>

            {/* End session button */}
            <div className="hud-end-btn" style={{
              position: 'absolute',
              bottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'auto',
            }}>
              <button
                onClick={endSession}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  color: 'rgba(255,140,50,0.5)',
                  textTransform: 'uppercase',
                  background: 'rgba(255,140,50,0.06)',
                  border: '1px solid rgba(255,140,50,0.15)',
                  borderRadius: 20,
                  padding: '8px 20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  minHeight: 40,
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,140,50,0.12)';
                  e.currentTarget.style.color = '#FF8C32';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,140,50,0.06)';
                  e.currentTarget.style.color = 'rgba(255,140,50,0.5)';
                }}
              >
                End Session
              </button>
            </div>

            {/* Corner vignette borders */}
            <div style={{
              position: 'absolute', top: 8, left: 8,
              width: 32, height: 32,
              borderTop: '2px solid rgba(255,140,50,0.25)',
              borderLeft: '2px solid rgba(255,140,50,0.25)',
              borderRadius: '4px 0 0 0',
            }} />
            <div style={{
              position: 'absolute', top: 8, right: 8,
              width: 32, height: 32,
              borderTop: '2px solid rgba(255,140,50,0.25)',
              borderRight: '2px solid rgba(255,140,50,0.25)',
              borderRadius: '0 4px 0 0',
            }} />
            <div style={{
              position: 'absolute', bottom: 8, left: 8,
              width: 32, height: 32,
              borderBottom: '2px solid rgba(255,140,50,0.25)',
              borderLeft: '2px solid rgba(255,140,50,0.25)',
              borderRadius: '0 0 0 4px',
            }} />
            <div style={{
              position: 'absolute', bottom: 8, right: 8,
              width: 32, height: 32,
              borderBottom: '2px solid rgba(255,140,50,0.25)',
              borderRight: '2px solid rgba(255,140,50,0.25)',
              borderRadius: '0 0 4px 0',
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Responsive + mobile Safari overrides ── */}
      <style>{`
        @media (max-width: 480px) {
          .hud-session-label {
            top: 56px !important;
            font-size: 8px !important;
          }
          .hud-toggle {
            top: 10px !important;
            left: 10px !important;
          }
          .hud-audio-toggle {
            top: 10px !important;
            right: 10px !important;
          }
          .hud-audio-panel {
            right: 10px !important;
            top: 52px !important;
            width: 220px !important;
          }
        }
        @media (max-height: 500px) {
          .hud-countdown {
            font-size: 36px !important;
          }
          .hud-progress-ring {
            width: 100px !important;
            height: 100px !important;
          }
          .hud-session-label {
            top: 36px !important;
          }
          .hud-end-btn {
            bottom: 12px !important;
          }
        }
        @keyframes deepWorkPulse {
          0%, 100% { box-shadow: 0 0 8px rgba(255,140,50,0.3); }
          50% { box-shadow: 0 0 20px rgba(255,140,50,0.5); }
        }
      `}</style>
    </>
  );
}
