import { useState, useEffect, useRef, useCallback } from 'react';

/* ══════════════════════════════════════════════════════════════ */
/*  AMBIENT AUDIO HOOK v2                                        */
/*  - Manages Web Audio API for brown noise / alpha waves        */
/*  - Smooth fade-in/out over configurable duration              */
/*  - Volume control with persistence via localStorage           */
/*  - Play/pause toggle independent of Deep Work state           */
/*  - Waveform analyser data for visualizer                      */
/*  - Auto-cleanup on unmount                                    */
/* ══════════════════════════════════════════════════════════════ */

const VOLUME_KEY = 'vive-ambient-volume';
const TRACK_KEY = 'vive-ambient-track';
const MUTED_KEY = 'vive-ambient-muted';
const FADE_MS = 1200;
const FADE_STEP_MS = 30;

export type AmbientTrack = 'brown-noise' | 'alpha-waves';

export interface AmbientAudioState {
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  track: AmbientTrack;
  setVolume: (v: number) => void;
  setTrack: (t: AmbientTrack) => void;
  togglePause: () => void;
  fadeIn: () => void;
  fadeOut: () => Promise<void>;
  getWaveform: () => Uint8Array | null;
}

function loadVolume(): number {
  try {
    const v = localStorage.getItem(VOLUME_KEY);
    if (v !== null) return Math.max(0, Math.min(1, parseFloat(v)));
  } catch { /* no-op */ }
  return 0.3;
}

function loadTrack(): AmbientTrack {
  try {
    const t = localStorage.getItem(TRACK_KEY);
    if (t === 'brown-noise' || t === 'alpha-waves') return t;
  } catch { /* no-op */ }
  return 'brown-noise';
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === 'true';
  } catch { /* no-op */ }
  return false;
}

function saveVolume(v: number) {
  try { localStorage.setItem(VOLUME_KEY, String(v)); } catch { /* no-op */ }
}

function saveTrack(t: AmbientTrack) {
  try { localStorage.setItem(TRACK_KEY, t); } catch { /* no-op */ }
}

function saveMuted(m: boolean) {
  try { localStorage.setItem(MUTED_KEY, String(m)); } catch { /* no-op */ }
}

/* ── Procedural audio generation via Web Audio API ── */

function createBrownNoise(ctx: AudioContext, gainNode: GainNode, analyser: AnalyserNode) {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * white) / 1.02;
    data[i] = lastOut * 3.5;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  filter.Q.value = 0.7;

  source.connect(filter);
  filter.connect(analyser);
  analyser.connect(gainNode);
  gainNode.connect(ctx.destination);
  source.start();

  return source;
}

function createAlphaWaves(ctx: AudioContext, gainNode: GainNode, analyser: AnalyserNode) {
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = 200;

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 210;

  const osc3 = ctx.createOscillator();
  osc3.type = 'sine';
  osc3.frequency.value = 100;

  const merge = ctx.createGain();
  merge.gain.value = 0.35;

  const subGain = ctx.createGain();
  subGain.gain.value = 0.15;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  filter.Q.value = 0.5;

  osc1.connect(merge);
  osc2.connect(merge);
  osc3.connect(subGain);
  subGain.connect(merge);
  merge.connect(filter);
  filter.connect(analyser);
  analyser.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc1.start();
  osc2.start();
  osc3.start();

  return { osc1, osc2, osc3 };
}

export function useAmbientAudio(active: boolean): AmbientAudioState {
  const [volume, setVolumeState] = useState(loadVolume);
  const [track, setTrackState] = useState<AmbientTrack>(loadTrack);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(loadMuted);

  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const oscRef = useRef<{ osc1: OscillatorNode; osc2: OscillatorNode; osc3: OscillatorNode } | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const targetVolumeRef = useRef(volume);
  const waveformBuf = useRef<Uint8Array | null>(null);

  useEffect(() => {
    targetVolumeRef.current = volume;
  }, [volume]);

  const cleanup = useCallback(() => {
    if (fadeRef.current) {
      clearInterval(fadeRef.current);
      fadeRef.current = null;
    }
    try { sourceRef.current?.stop(); } catch { /* no-op */ }
    sourceRef.current = null;
    try {
      oscRef.current?.osc1.stop();
      oscRef.current?.osc2.stop();
      oscRef.current?.osc3.stop();
    } catch { /* no-op */ }
    oscRef.current = null;
    try { ctxRef.current?.close(); } catch { /* no-op */ }
    ctxRef.current = null;
    gainRef.current = null;
    analyserRef.current = null;
    setIsPlaying(false);
  }, []);

  const fadeIn = useCallback(() => {
    cleanup();

    if (isPaused) return; // Don't start if user paused

    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.value = 0;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.85;

    ctxRef.current = ctx;
    gainRef.current = gain;
    analyserRef.current = analyser;
    waveformBuf.current = new Uint8Array(analyser.frequencyBinCount);

    if (track === 'brown-noise') {
      sourceRef.current = createBrownNoise(ctx, gain, analyser);
    } else {
      oscRef.current = createAlphaWaves(ctx, gain, analyser);
    }

    setIsPlaying(true);

    const steps = FADE_MS / FADE_STEP_MS;
    let step = 0;
    fadeRef.current = setInterval(() => {
      step++;
      const t = Math.min(1, step / steps);
      const eased = 1 - Math.pow(1 - t, 3);
      if (gainRef.current) {
        gainRef.current.gain.value = eased * targetVolumeRef.current;
      }
      if (step >= steps) {
        if (fadeRef.current) clearInterval(fadeRef.current);
        fadeRef.current = null;
      }
    }, FADE_STEP_MS);
  }, [track, cleanup, isPaused]);

  const fadeOut = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (!gainRef.current || !ctxRef.current) {
        cleanup();
        resolve();
        return;
      }

      if (fadeRef.current) {
        clearInterval(fadeRef.current);
        fadeRef.current = null;
      }

      const startVol = gainRef.current.gain.value;
      const steps = FADE_MS / FADE_STEP_MS;
      let step = 0;

      fadeRef.current = setInterval(() => {
        step++;
        const t = Math.min(1, step / steps);
        const eased = Math.pow(1 - t, 3);
        if (gainRef.current) {
          gainRef.current.gain.value = startVol * eased;
        }
        if (step >= steps) {
          if (fadeRef.current) clearInterval(fadeRef.current);
          fadeRef.current = null;
          cleanup();
          resolve();
        }
      }, FADE_STEP_MS);
    });
  }, [cleanup]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    saveVolume(clamped);
    if (gainRef.current && isPlaying) {
      gainRef.current.gain.value = clamped;
    }
  }, [isPlaying]);

  const setTrack = useCallback((t: AmbientTrack) => {
    setTrackState(t);
    saveTrack(t);
    if (isPlaying) {
      cleanup();
    }
  }, [isPlaying, cleanup]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      const next = !prev;
      saveMuted(next);
      if (next && isPlaying) {
        // Pause: fade out
        fadeOut();
      }
      return next;
    });
  }, [isPlaying, fadeOut]);

  // When unpaused while active, fade back in
  useEffect(() => {
    if (active && !isPaused && !isPlaying) {
      fadeIn();
    }
  }, [isPaused, active, isPlaying, fadeIn]);

  // Auto fade-in when Deep Work activates, fade-out when deactivated
  useEffect(() => {
    if (active && !isPaused) {
      fadeIn();
    } else if (!active) {
      fadeOut();
    }
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, track]);

  const getWaveform = useCallback((): Uint8Array | null => {
    if (!analyserRef.current || !waveformBuf.current) return null;
    analyserRef.current.getByteFrequencyData(waveformBuf.current);
    return waveformBuf.current;
  }, []);

  return {
    isPlaying,
    isPaused,
    volume,
    track,
    setVolume,
    setTrack,
    togglePause,
    fadeIn,
    fadeOut,
    getWaveform,
  };
}
