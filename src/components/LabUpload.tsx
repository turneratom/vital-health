import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

/* ══════════════════════════════════════════════════════════════
   LAB UPLOAD — Manual Biomarker Entry + AI Interpretation
   
   Now includes:
   • "Ultra-Fast" mode with tactile number-scrollers for Big 3
   • "Detailed" mode for full 10-marker panel
   • POST-SAVE: AI Interpretation Card with categorized results,
     red/yellow/green status badges, and one-line recommendations
   • FluidCanvas reacts in real-time to marker values
   ══════════════════════════════════════════════════════════════ */

const P = {
  bg: '#0A0A0C',
  surface: 'rgba(18,18,22,0.95)',
  glass: 'rgba(22,22,28,0.85)',
  text: '#E8E8EC',
  muted: 'rgba(255,255,255,0.45)',
  dim: 'rgba(255,255,255,0.2)',
  border: 'rgba(255,255,255,0.08)',
  borderHover: 'rgba(255,255,255,0.15)',
  accent: '#00FFCC',
  accentDim: 'rgba(0,255,204,0.15)',
  accentGlow: 'rgba(0,255,204,0.3)',
  warning: '#FFB86B',
  danger: '#FF6B6B',
  success: '#00FFCC',
};

/* ── Biomarker Definitions ── */
interface BiomarkerDef {
  id: string;
  name: string;
  unit: string;
  category: 'hormonal' | 'metabolic' | 'inflammatory' | 'cardiovascular' | 'nutritional';
  icon: string;
  optimalRange: [number, number];
  warningLow?: number;
  warningHigh?: number;
  placeholder: string;
  description: string;
}

const BIOMARKERS: BiomarkerDef[] = [
  { id: 'vitamin_d', name: 'Vitamin D', unit: 'ng/mL', category: 'nutritional', icon: '☀️', optimalRange: [40, 80], warningLow: 30, warningHigh: 100, placeholder: '52', description: 'Immune function, bone density, mood regulation' },
  { id: 'testosterone_total', name: 'Testosterone (Total)', unit: 'ng/dL', category: 'hormonal', icon: '⚡', optimalRange: [500, 900], warningLow: 300, warningHigh: 1100, placeholder: '680', description: 'Muscle synthesis, energy, cognitive drive' },
  { id: 'testosterone_free', name: 'Testosterone (Free)', unit: 'pg/mL', category: 'hormonal', icon: '🔥', optimalRange: [15, 25], warningLow: 9, warningHigh: 30, placeholder: '18.5', description: 'Bioavailable testosterone for tissue uptake' },
  { id: 'apob', name: 'ApoB', unit: 'mg/dL', category: 'cardiovascular', icon: '❤️', optimalRange: [40, 80], warningHigh: 100, placeholder: '72', description: 'Atherogenic particle count — primary CVD risk marker' },
  { id: 'hba1c', name: 'HbA1c', unit: '%', category: 'metabolic', icon: '🩸', optimalRange: [4.5, 5.4], warningHigh: 5.7, placeholder: '5.1', description: '90-day glucose average — metabolic health indicator' },
  { id: 'crp', name: 'hs-CRP', unit: 'mg/L', category: 'inflammatory', icon: '🛡️', optimalRange: [0, 1.0], warningHigh: 3.0, placeholder: '0.4', description: 'Systemic inflammation — lower is better' },
  { id: 'ferritin', name: 'Ferritin', unit: 'ng/mL', category: 'nutritional', icon: '🧲', optimalRange: [40, 150], warningLow: 20, warningHigh: 300, placeholder: '95', description: 'Iron storage — oxygen transport and energy' },
  { id: 'dhea_s', name: 'DHEA-S', unit: 'µg/dL', category: 'hormonal', icon: '🧬', optimalRange: [200, 400], warningLow: 100, warningHigh: 500, placeholder: '310', description: 'Adrenal reserve — stress resilience and longevity marker' },
  { id: 'homocysteine', name: 'Homocysteine', unit: 'µmol/L', category: 'cardiovascular', icon: '💜', optimalRange: [5, 9], warningHigh: 12, placeholder: '7.2', description: 'Methylation efficiency — cardiovascular and cognitive risk' },
  { id: 'fasting_insulin', name: 'Fasting Insulin', unit: 'µIU/mL', category: 'metabolic', icon: '📊', optimalRange: [2, 6], warningHigh: 10, placeholder: '4.5', description: 'Insulin sensitivity — metabolic flexibility indicator' },
];

const CATEGORIES = [
  { id: 'all', label: 'All Markers', icon: '🔬' },
  { id: 'hormonal', label: 'Hormonal', icon: '⚡' },
  { id: 'metabolic', label: 'Metabolic', icon: '🩸' },
  { id: 'cardiovascular', label: 'Cardiovascular', icon: '❤️' },
  { id: 'inflammatory', label: 'Inflammatory', icon: '🛡️' },
  { id: 'nutritional', label: 'Nutritional', icon: '☀️' },
];

/* ── Ultra-Fast Mode: Big 3 Markers ── */
const ULTRA_FAST_MARKERS = [
  { id: 'testosterone_total', name: 'Testosterone', unit: 'ng/dL', icon: '⚡', min: 100, max: 1200, step: 10, defaultValue: 600, optimalRange: [500, 900] as [number, number], warningLow: 300, warningHigh: 1100, description: 'Muscle synthesis & cognitive drive' },
  { id: 'apob', name: 'ApoB', unit: 'mg/dL', icon: '❤️', min: 20, max: 200, step: 1, defaultValue: 80, optimalRange: [40, 80] as [number, number], warningLow: undefined as number | undefined, warningHigh: 100, description: 'Primary cardiovascular risk marker' },
  { id: 'vitamin_d', name: 'Vitamin D', unit: 'ng/mL', icon: '☀️', min: 5, max: 120, step: 1, defaultValue: 45, optimalRange: [40, 80] as [number, number], warningLow: 30, warningHigh: 100, description: 'Immune function & mood regulation' },
];

/* ── Range Status ── */
function getRangeStatus(value: number, marker: BiomarkerDef | typeof ULTRA_FAST_MARKERS[0]): { label: string; color: string; glow: string } {
  if (value >= marker.optimalRange[0] && value <= marker.optimalRange[1]) {
    return { label: 'Optimal', color: P.accent, glow: P.accentGlow };
  }
  if (marker.warningLow && value < marker.warningLow) {
    return { label: 'Low', color: P.danger, glow: 'rgba(255,107,107,0.3)' };
  }
  if (marker.warningHigh && value > marker.warningHigh) {
    return { label: 'High', color: P.danger, glow: 'rgba(255,107,107,0.3)' };
  }
  return { label: 'Suboptimal', color: P.warning, glow: 'rgba(255,184,107,0.3)' };
}

function computeUltraFastHue(values: Record<string, number>): { hue: string; r: number; g: number; b: number } {
  let optimalCount = 0;
  let lowCount = 0;
  const total = ULTRA_FAST_MARKERS.length;
  for (const m of ULTRA_FAST_MARKERS) {
    const v = values[m.id];
    if (v === undefined) continue;
    if (v >= m.optimalRange[0] && v <= m.optimalRange[1]) optimalCount++;
    else if (m.warningLow && v < m.warningLow) lowCount++;
    else if (m.warningHigh && v > m.warningHigh) lowCount++;
  }
  const optRatio = optimalCount / total;
  const lowRatio = lowCount / total;
  if (optRatio >= 0.8) return { hue: 'optimal', r: 0, g: 220, b: 180 };
  if (lowRatio >= 0.5) return { hue: 'concern', r: 255, g: 130, b: 80 };
  if (optRatio >= 0.5) return { hue: 'good', r: 60, g: 200, b: 160 };
  return { hue: 'suboptimal', r: 255, g: 184, b: 107 };
}

function dispatchHueShift(r: number, g: number, b: number) {
  window.dispatchEvent(new CustomEvent('vive-fluid-hue-shift', { detail: { r, g, b, duration: 1200 } }));
}

function dispatchDataSyncPulse() {
  window.dispatchEvent(new CustomEvent('vive-data-sync-pulse', { detail: { timestamp: Date.now() } }));
}

/* ══════════════════════════════════════════════════════════════
   NUMBER SCROLLER — Tactile drum-style for Ultra-Fast mode
   ══════════════════════════════════════════════════════════════ */

function NumberScroller({ marker, value, onChange }: {
  marker: typeof ULTRA_FAST_MARKERS[0];
  value: number;
  onChange: (v: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastY = useRef(0);
  const velocity = useRef(0);
  const animFrame = useRef(0);
  const status = getRangeStatus(value, marker);
  const pct = ((value - marker.min) / (marker.max - marker.min)) * 100;
  const optStartPct = ((marker.optimalRange[0] - marker.min) / (marker.max - marker.min)) * 100;
  const optEndPct = ((marker.optimalRange[1] - marker.min) / (marker.max - marker.min)) * 100;
  const clamp = (v: number) => Math.max(marker.min, Math.min(marker.max, Math.round(v / marker.step) * marker.step));

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true;
    lastY.current = e.clientY;
    velocity.current = 0;
    cancelAnimationFrame(animFrame.current);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dy = lastY.current - e.clientY;
    lastY.current = e.clientY;
    velocity.current = dy;
    const delta = dy * marker.step * 0.3;
    const newVal = clamp(value + delta);
    if (newVal !== value) {
      onChange(newVal);
      const hueData = computeUltraFastHue({ [marker.id]: newVal });
      dispatchHueShift(hueData.r, hueData.g, hueData.b);
    }
  }, [value, onChange, marker]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    const decay = () => {
      if (Math.abs(velocity.current) < 0.5) return;
      velocity.current *= 0.92;
      const delta = velocity.current * marker.step * 0.15;
      const newVal = clamp(value + delta);
      if (newVal !== value) onChange(newVal);
      animFrame.current = requestAnimationFrame(decay);
    };
    animFrame.current = requestAnimationFrame(decay);
  }, [value, onChange, marker]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -marker.step : marker.step;
      const newVal = clamp(value + delta);
      if (newVal !== value) {
        onChange(newVal);
        const allVals: Record<string, number> = {};
        ULTRA_FAST_MARKERS.forEach(m => { allVals[m.id] = m.id === marker.id ? newVal : value; });
        const hueData = computeUltraFastHue(allVals);
        dispatchHueShift(hueData.r, hueData.g, hueData.b);
      }
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [value, onChange, marker]);

  const ticks = useMemo(() => {
    const result: number[] = [];
    for (let i = -3; i <= 3; i++) {
      const v = clamp(value + i * marker.step);
      if (!result.includes(v)) result.push(v);
    }
    return result;
  }, [value, marker]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{marker.icon}</span>
        <div className="text-center">
          <div className="font-mono text-xs font-bold tracking-wide" style={{ color: P.text }}>{marker.name}</div>
          <div className="font-mono text-[8px] tracking-[0.1em] uppercase" style={{ color: P.dim }}>{marker.description}</div>
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative w-full rounded-2xl overflow-hidden cursor-ns-resize select-none"
        style={{ background: 'rgba(12,12,16,0.9)', border: `1px solid ${status.color}25`, height: '180px', touchAction: 'none', boxShadow: `0 0 40px ${status.glow}, inset 0 0 30px rgba(0,0,0,0.4)`, transition: 'border-color 0.4s, box-shadow 0.6s' }}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
      >
        <div className="absolute right-0 top-0 w-1 rounded-full" style={{ top: `${100 - optEndPct}%`, height: `${optEndPct - optStartPct}%`, background: 'rgba(0,255,204,0.2)' }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {ticks.map((tick, i) => {
            const distFromCenter = Math.abs(i - 3);
            const opacity = distFromCenter === 0 ? 1 : distFromCenter === 1 ? 0.4 : distFromCenter === 2 ? 0.15 : 0.06;
            const scale = distFromCenter === 0 ? 1 : distFromCenter === 1 ? 0.7 : 0.5;
            const isCurrent = tick === value;
            const tickStatus = getRangeStatus(tick, marker);
            return (
              <div key={tick} className="font-mono tabular-nums font-bold transition-all duration-200" style={{ fontSize: isCurrent ? '42px' : '18px', color: isCurrent ? tickStatus.color : P.dim, opacity, transform: `scale(${scale})`, lineHeight: isCurrent ? '52px' : '26px', textShadow: isCurrent ? `0 0 20px ${tickStatus.glow}` : 'none' }}>
                {tick}
              </div>
            );
          })}
        </div>
        <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-[2px] rounded-full pointer-events-none" style={{ background: `linear-gradient(90deg, transparent, ${status.color}40, transparent)` }} />
        <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none" style={{ color: P.dim, fontSize: '10px', opacity: 0.4 }}>▲</div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none" style={{ color: P.dim, fontSize: '10px', opacity: 0.4 }}>▼</div>
      </div>
      <div className="flex items-center justify-between w-full mt-2 px-1">
        <span className="font-mono text-[9px] tracking-[0.1em] uppercase" style={{ color: P.dim }}>{marker.unit}</span>
        <div className="px-2.5 py-0.5 rounded-full font-mono text-[8px] tracking-[0.12em] uppercase font-bold" style={{ background: `${status.color}15`, color: status.color, border: `1px solid ${status.color}30` }}>{status.label}</div>
      </div>
      <div className="font-mono text-[7px] tracking-[0.12em] uppercase mt-1" style={{ color: P.dim }}>Optimal: {marker.optimalRange[0]}–{marker.optimalRange[1]} {marker.unit}</div>
      <div className="w-full h-1.5 rounded-full mt-2 overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="absolute top-0 h-full rounded-full" style={{ left: `${optStartPct}%`, width: `${optEndPct - optStartPct}%`, background: 'rgba(0,255,204,0.15)' }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full" style={{ left: `calc(${Math.max(0, Math.min(100, pct))}% - 6px)`, background: status.color, boxShadow: `0 0 8px ${status.glow}`, transition: 'left 0.15s ease-out' }} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SYNCING TO TWIN OVERLAY
   ══════════════════════════════════════════════════════════════ */

function SyncingToTwinOverlay({ isActive, onComplete }: { isActive: boolean; onComplete: () => void }) {
  const [phase, setPhase] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isActive) { setPhase(0); setProgress(0); return; }
    setPhase(1);
    const t1 = setInterval(() => { setProgress(p => { if (p >= 40) { clearInterval(t1); setPhase(2); return 40; } return p + 2; }); }, 50);
    const t2 = setTimeout(() => { const i2 = setInterval(() => { setProgress(p => { if (p >= 90) { clearInterval(i2); setPhase(3); return 90; } return p + 2.5; }); }, 40); }, 1000);
    const t3 = setTimeout(() => {
      setProgress(100);
      dispatchDataSyncPulse();
      window.dispatchEvent(new CustomEvent('vive-optimization-pulse', { detail: { r: 0, g: 255, b: 204, duration: 2000 } }));
      setTimeout(onComplete, 800);
    }, 3000);
    return () => { clearInterval(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [isActive, onComplete]);

  if (!isActive && phase === 0) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center" style={{ background: phase >= 3 ? 'rgba(0,20,15,0.95)' : 'rgba(5,5,5,0.97)', transition: 'background 0.8s ease' }}>
      {[1, 2, 3].map(ring => (
        <div key={ring} className="absolute rounded-full" style={{ width: `${80 + ring * 60}px`, height: `${80 + ring * 60}px`, border: `1px solid rgba(0,255,204,${0.3 - ring * 0.08})`, opacity: phase >= 1 ? 1 : 0, transform: phase >= 2 ? `scale(${1 + ring * 0.3})` : 'scale(1)', transition: `all ${0.8 + ring * 0.3}s cubic-bezier(0.4,0,0.2,1)`, animation: phase >= 1 && phase < 3 ? `syncPulseRing ${1.5 + ring * 0.3}s ease-in-out infinite` : 'none' }} />
      ))}
      <div className="relative w-20 h-20 rounded-full flex items-center justify-center" style={{ background: phase >= 3 ? 'radial-gradient(circle, rgba(0,255,204,0.3), rgba(0,255,204,0.05))' : 'radial-gradient(circle, rgba(0,255,204,0.15), transparent)', boxShadow: phase >= 2 ? '0 0 60px rgba(0,255,204,0.4)' : '0 0 30px rgba(0,255,204,0.15)', transition: 'all 0.8s ease' }}>
        <span className="text-3xl" style={{ filter: phase >= 3 ? 'brightness(1.3)' : 'none' }}>{phase >= 3 ? '✓' : '🧬'}</span>
      </div>
      <div className="mt-6 text-center">
        <div className="font-mono text-sm font-bold tracking-wide" style={{ color: phase >= 3 ? P.accent : P.text, transition: 'color 0.5s' }}>{phase >= 3 ? 'Twin Synchronized' : phase >= 2 ? 'Integrating Biology...' : 'Syncing to Twin'}</div>
        <div className="font-mono text-[9px] tracking-[0.1em] uppercase mt-2" style={{ color: P.dim }}>{phase >= 3 ? 'Your OS is now calibrated to your latest markers' : 'Mapping biomarkers to your digital twin'}</div>
      </div>
      <div className="w-48 h-1 rounded-full mt-5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${progress}%`, background: P.accent, boxShadow: `0 0 10px ${P.accentGlow}`, transition: 'width 0.3s ease-out' }} />
      </div>
      <style>{`@keyframes syncPulseRing { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.08); } }`}</style>
    </div>
  );
}

/* ── Range Bar ── */
function RangeBar({ value, marker }: { value: number; marker: BiomarkerDef }) {
  const min = (marker.warningLow ?? marker.optimalRange[0] * 0.5) * 0.8;
  const max = (marker.warningHigh ?? marker.optimalRange[1] * 1.5) * 1.1;
  const range = max - min;
  const optStart = ((marker.optimalRange[0] - min) / range) * 100;
  const optEnd = ((marker.optimalRange[1] - min) / range) * 100;
  const pos = Math.max(0, Math.min(100, ((value - min) / range) * 100));
  const status = getRangeStatus(value, marker);
  return (
    <div className="relative h-2 rounded-full overflow-hidden mt-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div className="absolute top-0 h-full rounded-full" style={{ left: `${optStart}%`, width: `${optEnd - optStart}%`, background: 'rgba(0,255,204,0.15)' }} />
      <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full" style={{ left: `calc(${pos}% - 5px)`, background: status.color, boxShadow: `0 0 8px ${status.glow}`, transition: 'left 0.5s cubic-bezier(0.4,0,0.2,1)' }} />
    </div>
  );
}

/* ── Marker Input Card ── */
function MarkerCard({ marker, value, onChange, existingValue }: {
  marker: BiomarkerDef; value: string; onChange: (v: string) => void; existingValue?: number;
  testDate?: string; onDateChange?: (d: string) => void;
}) {
  const numVal = parseFloat(value);
  const hasValue = value !== '' && !isNaN(numVal);
  const status = hasValue ? getRangeStatus(numVal, marker) : null;
  return (
    <div className="rounded-2xl p-4 transition-all duration-300" style={{ background: hasValue ? 'rgba(22,22,28,0.9)' : P.glass, border: `1px solid ${hasValue ? `${status?.color}30` : P.border}`, backdropFilter: 'blur(20px)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{marker.icon}</span>
          <div>
            <div className="font-mono text-[11px] font-semibold tracking-wide" style={{ color: P.text }}>{marker.name}</div>
            <div className="font-mono text-[8px] tracking-[0.1em] uppercase mt-0.5" style={{ color: P.dim }}>{marker.description}</div>
          </div>
        </div>
        {status && <div className="px-2 py-0.5 rounded-full font-mono text-[8px] tracking-[0.12em] uppercase font-bold" style={{ background: `${status.color}15`, color: status.color, border: `1px solid ${status.color}30` }}>{status.label}</div>}
        {existingValue !== undefined && !hasValue && <div className="px-2 py-0.5 rounded-full font-mono text-[8px] tracking-[0.12em] uppercase" style={{ background: 'rgba(0,255,204,0.08)', color: 'rgba(0,255,204,0.6)', border: '1px solid rgba(0,255,204,0.15)' }}>Last: {existingValue} {marker.unit}</div>}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input type="number" step="any" value={value} onChange={(e) => onChange(e.target.value)} placeholder={marker.placeholder}
            className="w-full bg-transparent font-mono text-lg font-bold tabular-nums outline-none"
            style={{ color: hasValue ? status?.color ?? P.text : P.dim, caretColor: P.accent, borderBottom: `1px solid ${hasValue ? `${status?.color}40` : P.border}`, paddingBottom: '4px', transition: 'all 0.3s ease' }}
          />
          <span className="absolute right-0 bottom-1.5 font-mono text-[9px] tracking-[0.1em] uppercase" style={{ color: P.dim }}>{marker.unit}</span>
        </div>
      </div>
      {hasValue && <RangeBar value={numVal} marker={marker} />}
      <div className="flex items-center justify-between mt-2">
        <span className="font-mono text-[7px] tracking-[0.12em] uppercase" style={{ color: P.dim }}>Optimal: {marker.optimalRange[0]}–{marker.optimalRange[1]} {marker.unit}</span>
        {hasValue && <span className="font-mono text-[7px] tracking-[0.12em] uppercase" style={{ color: status?.color }}>{numVal < marker.optimalRange[0] ? `${(marker.optimalRange[0] - numVal).toFixed(1)} below optimal` : numVal > marker.optimalRange[1] ? `${(numVal - marker.optimalRange[1]).toFixed(1)} above optimal` : 'Within range'}</span>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AI INTERPRETATION CARD — Post-save analysis
   
   Shows categorized biomarkers with status badges,
   reference ranges, and one-line AI recommendations.
   ══════════════════════════════════════════════════════════════ */

interface InterpretedMarker {
  id: string;
  name: string;
  value: number;
  unit: string;
  category: string;
  status: 'optimal' | 'suboptimal' | 'critical';
  statusLabel: string;
  recommendation: string;
  optimalRange: [number, number];
  percentFromOptimal: number;
}

interface InterpretationCategory {
  id: string;
  label: string;
  icon: string;
  markers: InterpretedMarker[];
  overallStatus: 'optimal' | 'suboptimal' | 'critical';
}

interface InterpretationResult {
  categories: InterpretationCategory[];
  overallSummary: string;
  criticalCount: number;
  optimalCount: number;
  totalMarkers: number;
  generatedAt: number;
  source: 'llm' | 'local';
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  optimal: { bg: 'rgba(0,255,204,0.08)', text: '#00FFCC', border: 'rgba(0,255,204,0.25)', glow: 'rgba(0,255,204,0.15)' },
  suboptimal: { bg: 'rgba(255,184,107,0.08)', text: '#FFB86B', border: 'rgba(255,184,107,0.25)', glow: 'rgba(255,184,107,0.15)' },
  critical: { bg: 'rgba(255,107,107,0.08)', text: '#FF6B6B', border: 'rgba(255,107,107,0.25)', glow: 'rgba(255,107,107,0.15)' },
};

function InterpretationCard({ data, onClose }: { data: InterpretationResult; onClose: () => void }) {
  const [expandedCat, setExpandedCat] = useState<string | null>(
    data.categories.find(c => c.overallStatus === 'critical')?.id ??
    data.categories.find(c => c.overallStatus === 'suboptimal')?.id ??
    data.categories[0]?.id ?? null
  );
  const [showAllRecs, setShowAllRecs] = useState(false);

  const overallColor = data.criticalCount > 0 ? STATUS_COLORS.critical : data.optimalCount === data.totalMarkers ? STATUS_COLORS.optimal : STATUS_COLORS.suboptimal;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: `1px solid ${P.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: overallColor.bg, border: `1px solid ${overallColor.border}`, boxShadow: `0 0 20px ${overallColor.glow}` }}>
              🧠
            </div>
            <div>
              <h2 className="font-mono text-sm font-bold tracking-wide" style={{ color: P.text }}>AI Interpretation</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: overallColor.text, boxShadow: `0 0 6px ${overallColor.glow}`, animation: 'interpretPulse 2s ease-in-out infinite' }} />
                <span className="font-mono text-[8px] tracking-[0.12em] uppercase" style={{ color: overallColor.text }}>
                  {data.source === 'llm' ? 'AI-Powered Analysis' : 'Local Analysis'}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${P.border}` }}>
            <span style={{ color: P.muted, fontSize: '14px' }}>✕</span>
          </button>
        </div>

        {/* Score Summary Bar */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 flex items-center gap-2">
            <div className="flex gap-1">
              {data.categories.map(cat => {
                const sc = STATUS_COLORS[cat.overallStatus];
                return (
                  <div key={cat.id} className="w-2 h-6 rounded-full" style={{ background: sc.text, opacity: 0.7 }} title={`${cat.label}: ${cat.overallStatus}`} />
                );
              })}
            </div>
            <span className="font-mono text-[9px] tabular-nums font-bold" style={{ color: overallColor.text }}>
              {data.optimalCount}/{data.totalMarkers} Optimal
            </span>
          </div>
          {data.criticalCount > 0 && (
            <div className="px-2 py-0.5 rounded-full font-mono text-[7px] tracking-[0.12em] uppercase font-bold" style={{ background: STATUS_COLORS.critical.bg, color: STATUS_COLORS.critical.text, border: `1px solid ${STATUS_COLORS.critical.border}` }}>
              {data.criticalCount} Critical
            </div>
          )}
        </div>

        {/* AI Summary */}
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${P.border}` }}>
          <div className="font-mono text-[9px] tracking-[0.1em] uppercase mb-1.5 flex items-center gap-1.5" style={{ color: P.muted }}>
            <span>🔬</span> Clinical Summary
          </div>
          <p className="font-mono text-[11px] leading-relaxed" style={{ color: P.text }}>
            {data.overallSummary}
          </p>
        </div>
      </div>

      {/* Category Panels */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: `${P.dim} transparent` }}>
        {data.categories.map(cat => {
          const isExpanded = expandedCat === cat.id;
          const catColor = STATUS_COLORS[cat.overallStatus];

          return (
            <div key={cat.id} className="rounded-2xl overflow-hidden transition-all duration-300" style={{ background: 'rgba(14,14,18,0.9)', border: `1px solid ${isExpanded ? catColor.border : P.border}` }}>
              {/* Category Header */}
              <button
                onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                className="w-full flex items-center justify-between p-4 transition-all duration-200"
                style={{ background: isExpanded ? catColor.bg : 'transparent' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{cat.icon}</span>
                  <div className="text-left">
                    <div className="font-mono text-[11px] font-bold tracking-wide" style={{ color: P.text }}>{cat.label}</div>
                    <div className="font-mono text-[8px] tracking-[0.1em] uppercase mt-0.5" style={{ color: P.dim }}>
                      {cat.markers.length} marker{cat.markers.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Mini status dots for each marker */}
                  <div className="flex gap-1">
                    {cat.markers.map(m => (
                      <div key={m.id} className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[m.status].text }} />
                    ))}
                  </div>
                  <div className="px-2 py-0.5 rounded-full font-mono text-[7px] tracking-[0.12em] uppercase font-bold" style={{ background: catColor.bg, color: catColor.text, border: `1px solid ${catColor.border}` }}>
                    {cat.overallStatus}
                  </div>
                  <span className="font-mono text-[10px] transition-transform duration-200" style={{ color: P.dim, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                </div>
              </button>

              {/* Expanded Marker Details */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-2.5" style={{ animation: 'interpretSlideDown 0.3s ease-out' }}>
                  {cat.markers.map(m => {
                    const mc = STATUS_COLORS[m.status];
                    const rangeMin = m.optimalRange[0];
                    const rangeMax = m.optimalRange[1];
                    const totalRange = rangeMax * 1.5;
                    const optStartPct = (rangeMin / totalRange) * 100;
                    const optEndPct = (rangeMax / totalRange) * 100;
                    const valuePct = Math.max(0, Math.min(100, (m.value / totalRange) * 100));

                    return (
                      <div key={m.id} className="rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${mc.border}40` }}>
                        {/* Marker Header Row */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="font-mono text-[11px] font-bold" style={{ color: P.text }}>{m.name}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-bold tabular-nums" style={{ color: mc.text, textShadow: `0 0 12px ${mc.glow}` }}>
                              {m.value}
                            </span>
                            <span className="font-mono text-[8px] tracking-[0.1em] uppercase" style={{ color: P.dim }}>{m.unit}</span>
                            <div className="px-2 py-0.5 rounded-full font-mono text-[7px] tracking-[0.12em] uppercase font-bold" style={{ background: mc.bg, color: mc.text, border: `1px solid ${mc.border}` }}>
                              {m.statusLabel}
                            </div>
                          </div>
                        </div>

                        {/* Visual Range Bar */}
                        <div className="relative h-2 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
                          <div className="absolute top-0 h-full rounded-full" style={{ left: `${optStartPct}%`, width: `${optEndPct - optStartPct}%`, background: 'rgba(0,255,204,0.12)' }} />
                          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full" style={{ left: `calc(${valuePct}% - 6px)`, background: mc.text, boxShadow: `0 0 8px ${mc.glow}` }} />
                        </div>

                        {/* Reference Range */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono text-[7px] tracking-[0.1em] uppercase" style={{ color: P.dim }}>
                            Ref: {rangeMin}–{rangeMax} {m.unit}
                          </span>
                          {m.percentFromOptimal !== 0 && (
                            <span className="font-mono text-[7px] tracking-[0.1em] uppercase" style={{ color: mc.text }}>
                              {m.percentFromOptimal > 0 ? `+${m.percentFromOptimal}%` : `${m.percentFromOptimal}%`} from optimal
                            </span>
                          )}
                        </div>

                        {/* AI Recommendation */}
                        <div className="rounded-lg p-2.5" style={{ background: `${mc.text}06`, borderLeft: `2px solid ${mc.text}40` }}>
                          <div className="font-mono text-[8px] tracking-[0.1em] uppercase mb-1 flex items-center gap-1" style={{ color: mc.text }}>
                            <span>💡</span> Recommendation
                          </div>
                          <p className="font-mono text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                            {m.recommendation}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${P.border}` }}>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl font-mono text-[11px] tracking-[0.12em] uppercase font-bold transition-all duration-300"
          style={{ background: P.accent, color: '#000', boxShadow: `0 0 25px ${P.accentGlow}` }}
        >
          Done — Return to Dashboard
        </button>
        <div className="text-center mt-2">
          <span className="font-mono text-[7px] tracking-[0.12em] uppercase" style={{ color: P.dim }}>
            Generated {new Date(data.generatedAt).toLocaleTimeString()} · {data.source === 'llm' ? 'AI-Enhanced' : 'Local Engine'}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes interpretPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes interpretSlideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DATA VERIFIED BADGE
   ══════════════════════════════════════════════════════════════ */

export function DataVerifiedBadge({ sessionId }: { sessionId: string }) {
  const labResults = useQuery(api.queries.getLabResults, { sessionId });
  const hasVerifiedData = labResults && labResults.length > 0;
  if (!hasVerifiedData) return null;
  const uniqueMarkers = new Set(labResults.map((r: any) => r.marker)).size;
  const latestDate = labResults.length > 0 ? new Date(labResults[0].testedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full cursor-default" style={{ background: 'rgba(0,255,204,0.08)', border: '1px solid rgba(0,255,204,0.2)', backdropFilter: 'blur(12px)' }} title={`${uniqueMarkers} verified biomarker${uniqueMarkers !== 1 ? 's' : ''} — last updated ${latestDate}`}>
      <div className="w-2 h-2 rounded-full" style={{ background: P.accent, boxShadow: `0 0 6px ${P.accentGlow}`, animation: 'verifiedPulse 2s ease-in-out infinite' }} />
      <span className="font-mono text-[8px] tracking-[0.14em] uppercase font-bold" style={{ color: 'rgba(0,255,204,0.85)' }}>Data Verified</span>
      <span className="font-mono text-[7px] tabular-nums" style={{ color: 'rgba(0,255,204,0.5)' }}>{uniqueMarkers} marker{uniqueMarkers !== 1 ? 's' : ''}</span>
      <style>{`@keyframes verifiedPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.2); } }`}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LAB UPLOAD MODAL — With AI Interpretation Post-Save
   ══════════════════════════════════════════════════════════════ */

interface LabUploadProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

export function LabUpload({ isOpen, onClose, sessionId }: LabUploadProps) {
  const [mode, setMode] = useState<'select' | 'ultra-fast' | 'detailed' | 'interpreting' | 'interpretation'>('select');
  const [activeCategory, setActiveCategory] = useState('all');
  const [values, setValues] = useState<Record<string, string>>({});
  const [ultraFastValues, setUltraFastValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    ULTRA_FAST_MARKERS.forEach(m => { init[m.id] = m.defaultValue; });
    return init;
  });
  const [testDate, setTestDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [activeScrollerIdx, setActiveScrollerIdx] = useState(0);
  const [interpretationData, setInterpretationData] = useState<InterpretationResult | null>(null);
  const [savedMarkers, setSavedMarkers] = useState<Array<{ id: string; value: number; unit: string }>>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  const createLabResult = useMutation(api.mutations.createLabResult);
  const generateInterpretation = useAction(api.aiBrain.generateLabInterpretation);
  const existingResults = useQuery(api.queries.getLabResults, { sessionId });

  const existingMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (existingResults) {
      for (const r of existingResults) {
        if (!map[r.marker]) map[r.marker] = r.value;
      }
    }
    return map;
  }, [existingResults]);

  useEffect(() => {
    if (existingResults && existingResults.length > 0) {
      const updated = { ...ultraFastValues };
      for (const m of ULTRA_FAST_MARKERS) {
        const existing = existingResults.find((r: any) => r.marker === m.id);
        if (existing) updated[m.id] = existing.value;
      }
      setUltraFastValues(updated);
    }
  }, [existingResults]);

  useEffect(() => {
    if (isOpen) {
      setMode('select');
      setSaved(false);
      setSyncing(false);
      setActiveScrollerIdx(0);
      setInterpretationData(null);
      setSavedMarkers([]);
    }
  }, [isOpen]);

  const filteredMarkers = activeCategory === 'all' ? BIOMARKERS : BIOMARKERS.filter((m) => m.category === activeCategory);
  const filledCount = Object.values(values).filter((v) => v !== '' && !isNaN(parseFloat(v))).length;

  /* ── Trigger AI Interpretation ── */
  const triggerInterpretation = useCallback(async (markers: Array<{ id: string; value: number; unit: string }>) => {
    setMode('interpreting');
    setSavedMarkers(markers);
    try {
      const result = await generateInterpretation({ sessionId, markers });
      setInterpretationData(result as InterpretationResult);
      setMode('interpretation');
    } catch (err) {
      console.warn('[LabUpload] AI interpretation failed:', err);
      // Fallback: just show saved state
      setMode('select');
      setSaved(true);
      setTimeout(() => { setSaved(false); onClose(); }, 2000);
    }
  }, [sessionId, generateInterpretation, onClose]);

  /* ── Ultra-Fast Save ── */
  const handleUltraFastSave = useCallback(async () => {
    setSyncing(true);
  }, []);

  const handleSyncComplete = useCallback(async () => {
    setSaving(true);
    const testedAt = new Date(testDate).getTime();
    const markers: Array<{ id: string; value: number; unit: string }> = [];

    for (const m of ULTRA_FAST_MARKERS) {
      const val = ultraFastValues[m.id];
      if (val === undefined) continue;
      await createLabResult({ sessionId, marker: m.id, value: val, unit: m.unit, source: 'manual', notes: 'Ultra-Fast entry', testedAt });
      markers.push({ id: m.id, value: val, unit: m.unit });
    }

    setSaving(false);
    setSavedCount(markers.length);
    setSyncing(false);
    window.dispatchEvent(new CustomEvent('vive-lab-results-updated', { detail: { count: markers.length } }));

    // Trigger AI interpretation
    await triggerInterpretation(markers);
  }, [ultraFastValues, testDate, sessionId, createLabResult, triggerInterpretation]);

  /* ── Detailed Save ── */
  const handleDetailedSave = useCallback(async () => {
    setSaving(true);
    const testedAt = new Date(testDate).getTime();
    const markers: Array<{ id: string; value: number; unit: string }> = [];

    for (const [markerId, val] of Object.entries(values)) {
      const numVal = parseFloat(val);
      if (isNaN(numVal)) continue;
      const marker = BIOMARKERS.find((m) => m.id === markerId);
      if (!marker) continue;
      await createLabResult({ sessionId, marker: markerId, value: numVal, unit: marker.unit, source: 'manual', notes: notes || undefined, testedAt });
      markers.push({ id: markerId, value: numVal, unit: marker.unit });
    }

    setSaving(false);
    setSavedCount(markers.length);
    window.dispatchEvent(new CustomEvent('vive-lab-results-updated', { detail: { count: markers.length } }));

    // Trigger AI interpretation
    await triggerInterpretation(markers);
  }, [values, testDate, notes, sessionId, createLabResult, triggerInterpretation]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) onClose();
  }, [onClose]);

  const currentHue = useMemo(() => computeUltraFastHue(ultraFastValues), [ultraFastValues]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} onClick={handleBackdropClick}>
      <div ref={modalRef} className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-3xl flex flex-col relative" style={{ background: P.bg, border: `1px solid ${P.border}`, boxShadow: '0 -8px 40px rgba(0,0,0,0.5), 0 0 80px rgba(0,255,204,0.03)', animation: 'labModalSlideUp 0.4s cubic-bezier(0.4,0,0.2,1)' }}>

        {/* Syncing Overlay */}
        <SyncingToTwinOverlay isActive={syncing} onComplete={handleSyncComplete} />

        {/* ══ AI INTERPRETATION VIEW ══ */}
        {mode === 'interpretation' && interpretationData && (
          <InterpretationCard data={interpretationData} onClose={onClose} />
        )}

        {/* ══ INTERPRETING LOADING STATE ══ */}
        {mode === 'interpreting' && (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="relative w-16 h-16 mb-6">
              <div className="absolute inset-0 rounded-full" style={{ border: '2px solid rgba(0,255,204,0.15)' }} />
              <div className="absolute inset-0 rounded-full" style={{ border: '2px solid transparent', borderTopColor: P.accent, animation: 'spin 1s linear infinite' }} />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">🧠</div>
            </div>
            <h3 className="font-mono text-sm font-bold tracking-wide mb-2" style={{ color: P.text }}>Analyzing Blood Panel</h3>
            <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-center" style={{ color: P.dim }}>
              Cross-referencing {savedMarkers.length} biomarkers against optimal ranges...
            </p>
            <div className="flex gap-1 mt-4">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: P.accent, animation: `interpretDot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {/* ══ MODE SELECTOR ══ */}
        {mode === 'select' && !saved && (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-5" style={{ background: P.accentDim, border: '1px solid rgba(0,255,204,0.2)' }}>🧪</div>
            <h2 className="font-mono text-base font-bold tracking-wide mb-1" style={{ color: P.text }}>Lab Entry</h2>
            <p className="font-mono text-[9px] tracking-[0.1em] uppercase mb-8" style={{ color: P.dim }}>Choose your input method</p>

            <button onClick={() => setMode('ultra-fast')} className="w-full rounded-2xl p-5 mb-3 text-left transition-all duration-300 group" style={{ background: 'rgba(0,255,204,0.04)', border: '1px solid rgba(0,255,204,0.15)' }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl">⚡</span>
                <div>
                  <div className="font-mono text-sm font-bold" style={{ color: P.accent }}>Ultra-Fast</div>
                  <div className="font-mono text-[8px] tracking-[0.1em] uppercase" style={{ color: P.dim }}>30 seconds · 3 key markers · AI interpretation</div>
                </div>
                <div className="ml-auto px-2 py-0.5 rounded-full font-mono text-[7px] tracking-[0.12em] uppercase font-bold" style={{ background: 'rgba(0,255,204,0.15)', color: P.accent, border: '1px solid rgba(0,255,204,0.25)' }}>Recommended</div>
              </div>
              <p className="font-mono text-[9px] leading-relaxed" style={{ color: P.muted }}>Scroll through Testosterone, ApoB, and Vitamin D. AI generates a clinical interpretation after save.</p>
            </button>

            <button onClick={() => setMode('detailed')} className="w-full rounded-2xl p-5 text-left transition-all duration-300" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${P.border}` }}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xl">🔬</span>
                <div>
                  <div className="font-mono text-sm font-bold" style={{ color: P.text }}>Detailed Entry</div>
                  <div className="font-mono text-[8px] tracking-[0.1em] uppercase" style={{ color: P.dim }}>Full panel · 10 biomarkers · AI interpretation</div>
                </div>
              </div>
              <p className="font-mono text-[9px] leading-relaxed" style={{ color: P.muted }}>Enter all biomarkers manually. AI analyzes your complete panel with categorized recommendations.</p>
            </button>

            <button onClick={onClose} className="mt-6 font-mono text-[9px] tracking-[0.1em] uppercase" style={{ color: P.dim }}>Cancel</button>
          </div>
        )}

        {/* ══ ULTRA-FAST MODE ══ */}
        {mode === 'ultra-fast' && !saved && !syncing && (
          <>
            <div className="px-5 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: `1px solid ${P.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <button onClick={() => setMode('select')} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${P.border}` }}><span style={{ color: P.muted, fontSize: '12px' }}>←</span></button>
                  <div>
                    <h2 className="font-mono text-sm font-bold tracking-wide" style={{ color: P.accent }}>⚡ Ultra-Fast Entry</h2>
                    <p className="font-mono text-[8px] tracking-[0.12em] uppercase mt-0.5" style={{ color: P.dim }}>Drag to scroll · AI interprets after save</p>
                  </div>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${P.border}` }}><span style={{ color: P.muted, fontSize: '14px' }}>✕</span></button>
              </div>
              <div className="flex gap-2 mt-2">
                {ULTRA_FAST_MARKERS.map((m, idx) => {
                  const isActive = activeScrollerIdx === idx;
                  const st = getRangeStatus(ultraFastValues[m.id], m);
                  return (
                    <button key={m.id} onClick={() => setActiveScrollerIdx(idx)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all duration-300" style={{ background: isActive ? `${st.color}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${isActive ? `${st.color}30` : P.border}` }}>
                      <span className="text-sm">{m.icon}</span>
                      <span className="font-mono text-[8px] tracking-[0.1em] uppercase font-semibold" style={{ color: isActive ? st.color : P.muted }}>{m.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex-1 overflow-hidden px-5 py-6">
              <div className="absolute inset-0 pointer-events-none transition-all duration-1000" style={{ background: `radial-gradient(ellipse at center bottom, rgba(${currentHue.r},${currentHue.g},${currentHue.b},0.06) 0%, transparent 70%)` }} />
              <div className="relative z-10">
                <NumberScroller
                  key={ULTRA_FAST_MARKERS[activeScrollerIdx].id}
                  marker={ULTRA_FAST_MARKERS[activeScrollerIdx]}
                  value={ultraFastValues[ULTRA_FAST_MARKERS[activeScrollerIdx].id]}
                  onChange={(v) => {
                    setUltraFastValues(prev => ({ ...prev, [ULTRA_FAST_MARKERS[activeScrollerIdx].id]: v }));
                    const allVals = { ...ultraFastValues, [ULTRA_FAST_MARKERS[activeScrollerIdx].id]: v };
                    const hue = computeUltraFastHue(allVals);
                    dispatchHueShift(hue.r, hue.g, hue.b);
                  }}
                />
              </div>
            </div>
            <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${P.border}` }}>
              <div className="flex gap-2 mb-3">
                {ULTRA_FAST_MARKERS.map((m) => {
                  const st = getRangeStatus(ultraFastValues[m.id], m);
                  return (
                    <div key={m.id} className="flex-1 rounded-lg p-2 text-center" style={{ background: `${st.color}08`, border: `1px solid ${st.color}20` }}>
                      <div className="font-mono text-[7px] tracking-[0.1em] uppercase mb-0.5" style={{ color: P.dim }}>{m.name}</div>
                      <div className="font-mono text-sm font-bold tabular-nums" style={{ color: st.color }}>{ultraFastValues[m.id]}</div>
                      <div className="font-mono text-[6px] tracking-[0.12em] uppercase" style={{ color: st.color }}>{st.label}</div>
                    </div>
                  );
                })}
              </div>
              <button onClick={handleUltraFastSave} className="w-full py-3 rounded-xl font-mono text-[11px] tracking-[0.12em] uppercase font-bold transition-all duration-300" style={{ background: P.accent, color: '#000', boxShadow: `0 0 25px ${P.accentGlow}` }}>
                Sync & Interpret
              </button>
            </div>
          </>
        )}

        {/* ══ DETAILED MODE ══ */}
        {mode === 'detailed' && !saved && (
          <>
            <div className="px-5 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: `1px solid ${P.border}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => setMode('select')} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${P.border}` }}><span style={{ color: P.muted, fontSize: '12px' }}>←</span></button>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: P.accentDim, border: '1px solid rgba(0,255,204,0.2)' }}>🔬</div>
                  <div>
                    <h2 className="font-mono text-sm font-bold tracking-wide" style={{ color: P.text }}>Detailed Lab Entry</h2>
                    <p className="font-mono text-[8px] tracking-[0.12em] uppercase mt-0.5" style={{ color: P.dim }}>AI interprets your panel after save</p>
                  </div>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${P.border}` }}><span style={{ color: P.muted, fontSize: '14px' }}>✕</span></button>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <span className="font-mono text-[9px] tracking-[0.1em] uppercase" style={{ color: P.muted }}>Test Date</span>
                <input type="date" value={testDate} onChange={(e) => setTestDate(e.target.value)} className="flex-1 bg-transparent font-mono text-[11px] outline-none px-2 py-1 rounded-lg" style={{ color: P.text, border: `1px solid ${P.border}`, colorScheme: 'dark' }} />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
                {CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  const count = cat.id === 'all' ? filledCount : Object.entries(values).filter(([k, v]) => { const m = BIOMARKERS.find((b) => b.id === k); return m?.category === cat.id && v !== '' && !isNaN(parseFloat(v)); }).length;
                  return (
                    <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all duration-200 flex-shrink-0" style={{ background: isActive ? P.accentDim : 'rgba(255,255,255,0.03)', border: `1px solid ${isActive ? 'rgba(0,255,204,0.25)' : P.border}`, color: isActive ? P.accent : P.muted }}>
                      <span className="text-xs">{cat.icon}</span>
                      <span className="font-mono text-[8px] tracking-[0.1em] uppercase font-semibold">{cat.label}</span>
                      {count > 0 && <span className="w-4 h-4 rounded-full flex items-center justify-center font-mono text-[7px] font-bold" style={{ background: P.accent, color: '#000' }}>{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: `${P.dim} transparent` }}>
              {filteredMarkers.map((marker) => (
                <MarkerCard key={marker.id} marker={marker} value={values[marker.id] || ''} onChange={(v) => setValues((prev) => ({ ...prev, [marker.id]: v }))} existingValue={existingMap[marker.id]} />
              ))}
            </div>
            <div className="px-5 py-4 flex-shrink-0" style={{ borderTop: `1px solid ${P.border}` }}>
              <div className="mb-3">
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Lab provider or notes (optional)" className="w-full bg-transparent font-mono text-[10px] outline-none px-3 py-2 rounded-lg" style={{ color: P.text, border: `1px solid ${P.border}`, caretColor: P.accent }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] tabular-nums" style={{ color: P.muted }}>{filledCount} marker{filledCount !== 1 ? 's' : ''} ready</span>
                <button onClick={handleDetailedSave} disabled={filledCount === 0 || saving} className="px-5 py-2.5 rounded-xl font-mono text-[10px] tracking-[0.12em] uppercase font-bold transition-all duration-300" style={{ background: filledCount > 0 ? P.accent : 'rgba(255,255,255,0.05)', color: filledCount > 0 ? '#000' : P.dim, border: `1px solid ${filledCount > 0 ? P.accent : P.border}`, boxShadow: filledCount > 0 ? `0 0 20px ${P.accentGlow}` : 'none', opacity: saving ? 0.6 : 1, cursor: filledCount === 0 || saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? <span className="flex items-center gap-2"><span className="inline-block w-3 h-3 border-2 border-black/30 border-t-black rounded-full" style={{ animation: 'spin 0.6s linear infinite' }} />Analyzing...</span> : `Save & Interpret ${filledCount} Result${filledCount !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Saved State (fallback if interpretation fails) ── */}
        {saved && mode === 'select' && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ background: P.accentDim, border: '1px solid rgba(0,255,204,0.3)', boxShadow: `0 0 30px ${P.accentGlow}`, animation: 'savedPop 0.5s cubic-bezier(0.4,0,0.2,1)' }}>✅</div>
            <h3 className="font-mono text-sm font-bold mb-1" style={{ color: P.accent }}>Twin Calibrated</h3>
            <p className="font-mono text-[9px] tracking-[0.1em] uppercase" style={{ color: P.muted }}>{savedCount} biomarker{savedCount !== 1 ? 's' : ''} integrated into your biological OS</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes labModalSlideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes savedPop { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes interpretDot { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1.2); } }
      `}</style>
    </div>
  );
}

export default LabUpload;
