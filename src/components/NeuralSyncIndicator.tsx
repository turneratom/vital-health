import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useBiometricSync } from '@/hooks/useBiometricSync';

/* ══════════════════════════════════════════════════════════════
 * NeuralSyncIndicator — Premium AI Brain Processing Indicator
 * 
 * Detects when the AI Brain is processing new biomarker data
 * from the BioTimeline and displays a futuristic glassmorphic
 * "thinking" animation with Proximity Glow effects.
 * 
 * Signals that the SomaticMirror is being updated in real-time.
 * ══════════════════════════════════════════════════════════════ */

/* ── Design Tokens — Dark Glassmorphism ── */
const G = {
  // Core
  bg: 'rgba(8,8,12,0.82)',
  bgActive: 'rgba(10,10,18,0.88)',
  glass: 'rgba(16,16,24,0.65)',
  border: 'rgba(255,255,255,0.04)',
  borderActive: 'rgba(120,140,255,0.18)',
  // Neural colors
  neural: '#7B8CDE',
  neuralBright: '#9BABFF',
  neuralGlow: 'rgba(123,140,222,0.15)',
  neuralFaint: 'rgba(123,140,222,0.06)',
  // Accent
  cyan: '#00FFCC',
  cyanGlow: 'rgba(0,255,204,0.12)',
  violet: '#B8A9C9',
  violetGlow: 'rgba(184,169,201,0.10)',
  amber: '#E8C06C',
  amberGlow: 'rgba(232,192,108,0.10)',
  sage: '#7CB68E',
  sageGlow: 'rgba(124,182,142,0.10)',
  // Text
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.50)',
  textDim: 'rgba(255,255,255,0.25)',
  textMicro: 'rgba(255,255,255,0.18)',
};

/* ── Processing state types ── */
type NeuralState = 'idle' | 'detecting' | 'processing' | 'merging' | 'updated';

interface BiomarkerDelta {
  id: string;
  name: string;
  icon: string;
  prevValue: number;
  newValue: number;
  unit: string;
  color: string;
  glowColor: string;
  timestamp: number;
}

const STATE_CONFIG: Record<NeuralState, { label: string; sublabel: string; color: string; glow: string }> = {
  idle: { label: 'NEURAL SYNC', sublabel: 'SomaticMirror standing by', color: G.textDim, glow: 'transparent' },
  detecting: { label: 'SIGNAL DETECTED', sublabel: 'New biomarker data incoming', color: G.amber, glow: G.amberGlow },
  processing: { label: 'AI BRAIN ACTIVE', sublabel: 'Processing BioTimeline stream', color: G.neural, glow: G.neuralGlow },
  merging: { label: 'NEURAL MERGE', sublabel: 'Updating SomaticMirror model', color: G.violet, glow: G.violetGlow },
  updated: { label: 'MIRROR SYNCED', sublabel: 'Biological model current', color: G.sage, glow: G.sageGlow },
};

/* ── Keyframes injected once ── */
const KEYFRAMES = `
@keyframes ns-orbit {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes ns-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.9; transform: scale(1.08); }
}
@keyframes ns-breathe {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.45; }
}
@keyframes ns-dataStream {
  0% { opacity: 0; transform: translateY(6px) scale(0.8); }
  30% { opacity: 1; transform: translateY(0) scale(1); }
  70% { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-6px) scale(0.8); }
}
@keyframes ns-glowPulse {
  0%, 100% { box-shadow: 0 0 12px var(--ns-glow), inset 0 0 20px var(--ns-glow-inner); }
  50% { box-shadow: 0 0 28px var(--ns-glow), 0 0 56px var(--ns-glow-outer), inset 0 0 30px var(--ns-glow-inner); }
}
@keyframes ns-ripple {
  0% { transform: scale(0.8); opacity: 0.6; }
  100% { transform: scale(2.2); opacity: 0; }
}
@keyframes ns-slideIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes ns-barPulse {
  0%, 100% { height: 3px; opacity: 0.3; }
  50% { height: var(--bar-h); opacity: 1; }
}
@keyframes ns-checkPop {
  0% { transform: scale(0) rotate(-45deg); opacity: 0; }
  60% { transform: scale(1.2) rotate(0deg); }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
`;

export default function NeuralSyncIndicator() {
  const { vitals, isSyncing: bioSyncing } = useBiometricSync();
  const [neuralState, setNeuralState] = useState<NeuralState>('idle');
  const [deltas, setDeltas] = useState<BiomarkerDelta[]>([]);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [dataPointsProcessed, setDataPointsProcessed] = useState(0);
  const [animPhase, setAnimPhase] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(16).fill(0.15));
  const prevVitalsRef = useRef<Record<string, number>>({});
  const processingRef = useRef(false);
  const wavePhaseRef = useRef(0);
  const animFrameRef = useRef(0);

  // Animation tick
  useEffect(() => {
    const iv = setInterval(() => setAnimPhase(p => (p + 1) % 240), 25);
    return () => clearInterval(iv);
  }, []);

  // Waveform animation when processing
  useEffect(() => {
    if (neuralState !== 'processing' && neuralState !== 'merging') {
      setWaveformBars(Array(16).fill(0.15));
      return;
    }
    const animate = () => {
      wavePhaseRef.current += 0.06;
      const phase = wavePhaseRef.current;
      const bars = Array.from({ length: 16 }, (_, i) => {
        const w1 = Math.sin(phase + i * 0.5) * 0.35;
        const w2 = Math.cos(phase * 1.4 + i * 0.3) * 0.25;
        const w3 = Math.sin(phase * 0.7 + i * 0.8) * 0.15;
        return Math.max(0.08, Math.min(1, 0.2 + w1 + w2 + w3 + Math.random() * 0.08));
      });
      setWaveformBars(bars);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [neuralState]);

  // Detect biomarker changes and trigger processing animation
  const detectChanges = useCallback(() => {
    const currentVitals: Record<string, { value: number; name: string; icon: string; unit: string; color: string; glowColor: string }> = {
      hrv: { value: vitals.hrv, name: 'HRV', icon: '💓', unit: 'ms', color: G.neural, glowColor: G.neuralGlow },
      heartRate: { value: vitals.heartRate, name: 'Heart Rate', icon: '❤️', unit: 'bpm', color: '#FF6B6B', glowColor: 'rgba(255,107,107,0.12)' },
      sleepScore: { value: vitals.sleepScore, name: 'Sleep Score', icon: '🌙', unit: '', color: G.violet, glowColor: G.violetGlow },
      recovery: { value: vitals.recovery, name: 'Recovery', icon: '⚡', unit: '%', color: G.cyan, glowColor: G.cyanGlow },
      spo2: { value: vitals.spo2, name: 'SpO2', icon: '🫁', unit: '%', color: G.sage, glowColor: G.sageGlow },
      strain: { value: vitals.strain, name: 'Strain', icon: '🏋️', unit: '', color: G.amber, glowColor: G.amberGlow },
      bodyBattery: { value: vitals.bodyBattery, name: 'Body Battery', icon: '🔋', unit: '', color: '#00DC82', glowColor: 'rgba(0,220,130,0.12)' },
      stress: { value: vitals.stress, name: 'Stress', icon: '🧘', unit: '', color: '#E8976C', glowColor: 'rgba(232,151,108,0.12)' },
    };

    const newDeltas: BiomarkerDelta[] = [];
    const prev = prevVitalsRef.current;

    for (const [key, config] of Object.entries(currentVitals)) {
      const prevVal = prev[key];
      if (prevVal !== undefined && Math.abs(config.value - prevVal) > 0.5) {
        newDeltas.push({
          id: key,
          name: config.name,
          icon: config.icon,
          prevValue: prevVal,
          newValue: config.value,
          unit: config.unit,
          color: config.color,
          glowColor: config.glowColor,
          timestamp: Date.now(),
        });
      }
      prev[key] = config.value;
    }

    prevVitalsRef.current = prev;
    return newDeltas;
  }, [vitals]);

  // Run processing animation when changes detected
  const runProcessingSequence = useCallback(async (newDeltas: BiomarkerDelta[]) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setDeltas(newDeltas);
    setDataPointsProcessed(0);

    // Phase 1: Detecting
    setNeuralState('detecting');
    setProcessingProgress(10);
    await new Promise(r => setTimeout(r, 600));

    // Phase 2: Processing
    setNeuralState('processing');
    setExpanded(true);
    for (let i = 0; i < 5; i++) {
      setProcessingProgress(20 + i * 12);
      setDataPointsProcessed(p => p + Math.floor(Math.random() * 40 + 15));
      await new Promise(r => setTimeout(r, 250));
    }

    // Phase 3: Neural Merge
    setNeuralState('merging');
    setProcessingProgress(85);
    setDataPointsProcessed(p => p + Math.floor(Math.random() * 60 + 30));
    await new Promise(r => setTimeout(r, 800));

    // Phase 4: Complete
    setNeuralState('updated');
    setProcessingProgress(100);

    // Broadcast neural sync event
    window.dispatchEvent(new CustomEvent('vive-neural-sync', {
      detail: { timestamp: Date.now(), deltas: newDeltas.map(d => d.id), dataPoints: dataPointsProcessed },
    }));

    // Reset after showing complete
    await new Promise(r => setTimeout(r, 2500));
    setNeuralState('idle');
    setProcessingProgress(0);
    setDeltas([]);
    setDataPointsProcessed(0);
    processingRef.current = false;
  }, []);

  // Watch for vitals changes
  useEffect(() => {
    const newDeltas = detectChanges();
    if (newDeltas.length > 0 && !processingRef.current) {
      runProcessingSequence(newDeltas);
    }
  }, [
    vitals.hrv, vitals.heartRate, vitals.sleepScore, vitals.recovery,
    vitals.spo2, vitals.strain, vitals.bodyBattery, vitals.stress,
    detectChanges, runProcessingSequence,
  ]);

  // Listen for external deep-sync events
  useEffect(() => {
    const handler = () => {
      if (!processingRef.current) {
        const syntheticDeltas: BiomarkerDelta[] = [
          { id: 'deep-sync', name: 'Deep Sync', icon: '🧠', prevValue: 0, newValue: 100, unit: '%', color: G.violet, glowColor: G.violetGlow, timestamp: Date.now() },
        ];
        runProcessingSequence(syntheticDeltas);
      }
    };
    window.addEventListener('vive-deep-sync', handler);
    return () => window.removeEventListener('vive-deep-sync', handler);
  }, [runProcessingSequence]);

  // Also trigger on biometric sync activity
  useEffect(() => {
    if (bioSyncing && !processingRef.current) {
      const syntheticDeltas: BiomarkerDelta[] = [
        { id: 'bio-sync', name: 'Biometric Sync', icon: '📡', prevValue: 0, newValue: 100, unit: '%', color: G.neural, glowColor: G.neuralGlow, timestamp: Date.now() },
      ];
      runProcessingSequence(syntheticDeltas);
    }
  }, [bioSyncing, runProcessingSequence]);

  const isActive = neuralState !== 'idle';
  const config = STATE_CONFIG[neuralState];
  const pulseOpacity = 0.4 + 0.6 * Math.sin((animPhase / 240) * Math.PI * 2);
  const orbRotation = (animPhase / 240) * 360;

  // Proximity glow intensity based on state
  const glowIntensity = useMemo(() => {
    switch (neuralState) {
      case 'detecting': return 0.3;
      case 'processing': return 0.6;
      case 'merging': return 0.9;
      case 'updated': return 0.5;
      default: return 0;
    }
  }, [neuralState]);

  return (
    <div
      className="relative overflow-hidden transition-all duration-500"
      style={{
        borderRadius: 16,
        background: isActive ? G.bgActive : G.bg,
        border: `1px solid ${isActive ? G.borderActive : G.border}`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        ['--ns-glow' as any]: `${config.color}20`,
        ['--ns-glow-inner' as any]: `${config.color}08`,
        ['--ns-glow-outer' as any]: `${config.color}10`,
        animation: isActive ? 'ns-glowPulse 2.5s ease-in-out infinite' : 'none',
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* ── Proximity Glow Background ── */}
      {isActive && (
        <>
          <div
            className="absolute pointer-events-none"
            style={{
              top: '-30%', left: '-20%', width: '140%', height: '160%',
              background: `radial-gradient(ellipse at 50% 30%, ${config.color}${Math.round(glowIntensity * 12).toString(16).padStart(2, '0')}, transparent 65%)`,
              animation: 'ns-breathe 3s ease-in-out infinite',
              transition: 'all 0.8s ease',
            }}
          />
          {/* Ripple rings */}
          {neuralState === 'merging' && (
            <>
              <div className="absolute pointer-events-none" style={{
                top: '50%', left: '50%', width: 60, height: 60,
                marginTop: -30, marginLeft: -30, borderRadius: '50%',
                border: `1px solid ${G.violet}30`,
                animation: 'ns-ripple 2s ease-out infinite',
              }} />
              <div className="absolute pointer-events-none" style={{
                top: '50%', left: '50%', width: 60, height: 60,
                marginTop: -30, marginLeft: -30, borderRadius: '50%',
                border: `1px solid ${G.violet}20`,
                animation: 'ns-ripple 2s ease-out infinite 0.7s',
              }} />
            </>
          )}
        </>
      )}

      {/* ── Header Row ── */}
      <button
        onClick={() => !isActive && setExpanded(p => !p)}
        className="relative w-full flex items-center gap-3 px-3.5 py-3 text-left"
        style={{ cursor: isActive ? 'default' : 'pointer' }}
      >
        {/* Neural Orb */}
        <div className="relative flex-shrink-0" style={{ width: 36, height: 36 }}>
          {/* Outer orbital ring */}
          <svg
            viewBox="0 0 36 36"
            className="absolute inset-0 w-full h-full"
            style={{
              animation: isActive ? 'ns-orbit 4s linear infinite' : 'none',
              filter: isActive ? `drop-shadow(0 0 6px ${config.color}40)` : 'none',
              transition: 'filter 0.5s',
            }}
          >
            <circle cx="18" cy="18" r="16" fill="none" stroke={`${config.color}15`} strokeWidth="1" />
            <circle
              cx="18" cy="18" r="16" fill="none"
              stroke={isActive ? config.color : G.textDim}
              strokeWidth="1.5"
              strokeDasharray={isActive ? `${processingProgress * 1.005} 100.5` : '25 75.5'}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s' }}
            />
            {/* Orbital dot */}
            {isActive && (
              <circle
                cx={18 + 16 * Math.cos((orbRotation * Math.PI) / 180)}
                cy={18 + 16 * Math.sin((orbRotation * Math.PI) / 180)}
                r="2" fill={config.color}
                style={{ filter: `drop-shadow(0 0 4px ${config.color})` }}
              />
            )}
          </svg>

          {/* Inner core */}
          <div
            className="absolute flex items-center justify-center"
            style={{
              top: 7, left: 7, width: 22, height: 22,
              borderRadius: '50%',
              background: isActive ? `${config.color}12` : G.neuralFaint,
              border: `1px solid ${isActive ? `${config.color}30` : G.border}`,
              animation: isActive ? 'ns-pulse 2s ease-in-out infinite' : 'none',
              transition: 'all 0.4s',
            }}
          >
            <span style={{ fontSize: 11, filter: isActive ? `drop-shadow(0 0 3px ${config.color})` : 'none' }}>
              {neuralState === 'updated' ? '✓' : neuralState === 'merging' ? '🧬' : '🧠'}
            </span>
          </div>

          {/* Activity indicator dot */}
          {isActive && (
            <div
              className="absolute"
              style={{
                top: 1, right: 1, width: 7, height: 7,
                borderRadius: '50%',
                background: config.color,
                boxShadow: `0 0 8px ${config.color}80`,
                animation: 'ns-pulse 1.2s ease-in-out infinite',
              }}
            />
          )}
        </div>

        {/* Labels */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-bold tracking-wide"
              style={{
                fontFamily: 'monospace',
                color: isActive ? config.color : G.textSec,
                letterSpacing: '0.08em',
                transition: 'color 0.4s',
                textShadow: isActive ? `0 0 12px ${config.color}40` : 'none',
              }}
            >
              {config.label}
            </span>
            {isActive && processingProgress > 0 && (
              <span
                className="text-[8px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded-full"
                style={{
                  background: `${config.color}12`,
                  color: config.color,
                  border: `1px solid ${config.color}20`,
                }}
              >
                {Math.round(processingProgress)}%
              </span>
            )}
          </div>
          <span
            className="text-[9px] block"
            style={{
              fontFamily: 'monospace',
              color: isActive ? `${config.color}80` : G.textDim,
              transition: 'color 0.4s',
            }}
          >
            {config.sublabel}
          </span>
        </div>

        {/* State badge */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-full flex-shrink-0 transition-all duration-500"
          style={{
            background: isActive ? `${config.color}10` : 'rgba(255,255,255,0.02)',
            border: `1px solid ${isActive ? `${config.color}20` : G.border}`,
          }}
        >
          <div
            className="rounded-full transition-all duration-300"
            style={{
              width: 5, height: 5,
              background: isActive ? config.color : G.textDim,
              boxShadow: isActive ? `0 0 8px ${config.color}80` : 'none',
            }}
          />
          <span
            className="text-[7px] font-bold font-mono tracking-widest uppercase"
            style={{ color: isActive ? config.color : G.textDim }}
          >
            {isActive ? 'ACTIVE' : 'IDLE'}
          </span>
        </div>

        {/* Expand chevron */}
        {!isActive && (
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke={G.textDim} strokeWidth="2" strokeLinecap="round"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {/* ── Processing Progress Bar ── */}
      {isActive && (
        <div className="px-3.5 pb-1">
          <div
            className="h-[2px] rounded-full overflow-hidden relative"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${processingProgress}%`,
                background: `linear-gradient(90deg, ${config.color}80, ${config.color})`,
                boxShadow: `0 0 12px ${config.color}60`,
              }}
            />
            {/* Shimmer */}
            <div
              className="absolute inset-0 h-full w-1/4"
              style={{
                background: `linear-gradient(90deg, transparent, ${config.color}30, transparent)`,
                animation: 'syncWave 1.2s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Expanded Content ── */}
      {(expanded || isActive) && (
        <div
          className="px-3.5 pb-3.5 space-y-3"
          style={{ animation: 'ns-slideIn 0.3s ease both' }}
        >
          {/* ── Neural Waveform Visualizer ── */}
          {(neuralState === 'processing' || neuralState === 'merging') && (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: G.glass,
                border: `1px solid ${config.color}12`,
                padding: '10px 12px',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[8px] font-mono font-bold tracking-widest uppercase" style={{ color: config.color }}>
                  NEURAL WAVEFORM
                </span>
                <span className="text-[8px] font-mono tabular-nums" style={{ color: G.textDim }}>
                  {dataPointsProcessed} pts
                </span>
              </div>
              <div className="flex items-end justify-center gap-[3px]" style={{ height: 32 }}>
                {waveformBars.map((bar, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all"
                    style={{
                      width: 3,
                      height: `${Math.max(3, bar * 32)}px`,
                      background: `linear-gradient(to top, ${config.color}40, ${config.color})`,
                      boxShadow: bar > 0.6 ? `0 0 6px ${config.color}50` : 'none',
                      opacity: 0.4 + bar * 0.6,
                      transitionDuration: '80ms',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Biomarker Deltas ── */}
          {deltas.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[8px] font-mono font-bold tracking-widest uppercase block" style={{ color: G.textDim }}>
                BIOMARKER CHANGES DETECTED
              </span>
              {deltas.map((delta, i) => (
                <div
                  key={delta.id}
                  className="flex items-center gap-2.5 rounded-lg overflow-hidden"
                  style={{
                    padding: '7px 10px',
                    background: delta.glowColor,
                    border: `1px solid ${delta.color}15`,
                    animation: `ns-slideIn 0.3s ease both ${i * 0.08}s`,
                    boxShadow: neuralState === 'merging' ? `0 0 12px ${delta.color}15` : 'none',
                    transition: 'box-shadow 0.5s',
                  }}
                >
                  {/* Icon with glow */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `${delta.color}15`,
                      border: `1px solid ${delta.color}20`,
                      boxShadow: neuralState === 'merging' ? `0 0 8px ${delta.color}30` : 'none',
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{delta.icon}</span>
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold font-mono" style={{ color: G.text }}>
                      {delta.name}
                    </span>
                  </div>

                  {/* Value change */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[9px] font-mono tabular-nums" style={{ color: G.textDim }}>
                      {delta.prevValue.toFixed(delta.unit === '%' ? 1 : 0)}
                    </span>
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4H8M8 4L5.5 1.5M8 4L5.5 6.5" stroke={delta.color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: delta.color, textShadow: `0 0 8px ${delta.color}40` }}>
                      {delta.newValue.toFixed(delta.unit === '%' ? 1 : 0)}{delta.unit}
                    </span>
                  </div>

                  {/* Completion check */}
                  {neuralState === 'updated' && (
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{
                        background: `${G.sage}20`,
                        animation: `ns-checkPop 0.4s ease both ${i * 0.1}s`,
                      }}
                    >
                      <span style={{ fontSize: 8, color: G.sage }}>✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Processing Stats ── */}
          {isActive && dataPointsProcessed > 0 && (
            <div
              className="flex items-center justify-between rounded-lg"
              style={{
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${G.border}`,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-[8px]" style={{ animation: isActive ? 'ns-dataStream 1.2s ease-in-out infinite' : 'none' }}>
                  📊
                </span>
                <span className="text-[8px] font-mono tracking-wider uppercase" style={{ color: G.textDim }}>
                  Data Points Processed
                </span>
              </div>
              <span className="text-[10px] font-bold font-mono tabular-nums" style={{ color: config.color }}>
                {dataPointsProcessed.toLocaleString()}
              </span>
            </div>
          )}

          {/* ── SomaticMirror Status ── */}
          {neuralState === 'idle' && (
            <div
              className="rounded-lg"
              style={{
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${G.border}`,
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ fontSize: 10 }}>🪞</span>
                <span className="text-[9px] font-mono font-bold tracking-wider uppercase" style={{ color: G.textSec }}>
                  SomaticMirror Status
                </span>
              </div>
              <div className="flex items-center gap-3">
                {[
                  { label: 'Model', value: 'Current', color: G.sage },
                  { label: 'Latency', value: '<2s', color: G.neural },
                  { label: 'Streams', value: '8/8', color: G.cyan },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-1.5">
                    <span className="text-[7px] font-mono tracking-wider uppercase" style={{ color: G.textDim }}>
                      {s.label}
                    </span>
                    <span className="text-[9px] font-mono font-bold" style={{ color: s.color }}>
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
