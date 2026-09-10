import React, { useState, useEffect, useMemo, useCallback } from 'react';

/* ══════════════════════════════════════════════════════════════ */
/*  PROTOCOL GENERATOR — Bio-Vault Reactive Supplement Engine    */
/*  Scans Last Sync biometric data (Vitamin D, Cortisol, HRV)   */
/*  and generates OPTIMAL PROTOCOL directives with clinical      */
/*  ACTION / DOSAGE / TIMING columns.                            */
/* ══════════════════════════════════════════════════════════════ */

interface BioMarker {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  optimalRange: [number, number];
  status: 'optimal' | 'suboptimal' | 'deficient' | 'elevated' | 'unknown';
}

interface ProtocolAction {
  id: string;
  action: string;
  dosage: string;
  timing: string;
  priority: 'critical' | 'recommended' | 'advisory';
  linkedMarker: string;
  markerValue: number | null;
  markerUnit: string;
  rationale: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#FF6B6B',
  recommended: '#FFB86B',
  advisory: '#00FFCC',
};

function evaluateMarker(value: number | null, optimal: [number, number], higherIsBad?: boolean): BioMarker['status'] {
  if (value === null || value === undefined) return 'unknown';
  if (value >= optimal[0] && value <= optimal[1]) return 'optimal';
  if (higherIsBad) {
    return value > optimal[1] ? 'elevated' : 'suboptimal';
  }
  return value < optimal[0] ? 'deficient' : 'elevated';
}

function deriveActions(markers: BioMarker[], hrvCurrent: number, cortisol: number | null): ProtocolAction[] {
  const actions: ProtocolAction[] = [];

  const vitD = markers.find(m => m.id === 'vitaminD');
  if (vitD && vitD.value !== null && vitD.value < 30) {
    actions.push({
      id: 'lipod3k2',
      action: 'INCREASE LIPO-D3/K2',
      dosage: '5000 IU',
      timing: 'AM · with fat-containing meal',
      priority: vitD.value < 20 ? 'critical' : 'recommended',
      linkedMarker: 'Vitamin D',
      markerValue: vitD.value,
      markerUnit: 'ng/mL',
      rationale: `Serum 25(OH)D at ${vitD.value} ng/mL — below 30 ng/mL threshold. Liposomal D3+K2 for enhanced absorption.`,
    });
  }

  if (cortisol !== null && cortisol > 20) {
    actions.push({
      id: 'ashwagandha',
      action: 'INTRODUCE ASHWAGANDHA KSM-66',
      dosage: '600mg',
      timing: 'AM · with breakfast',
      priority: cortisol > 25 ? 'critical' : 'recommended',
      linkedMarker: 'Cortisol',
      markerValue: cortisol,
      markerUnit: 'µg/dL',
      rationale: `Cortisol at ${cortisol} µg/dL — elevated beyond optimal range. KSM-66 shown to reduce cortisol 28% in 60 days.`,
    });
  }

  const ferritin = markers.find(m => m.id === 'ferritin');
  if (ferritin && ferritin.value !== null && ferritin.value < 40) {
    actions.push({
      id: 'iron-bisglycinate',
      action: 'IRON BISGLYCINATE + VIT C',
      dosage: '25mg Fe + 200mg C',
      timing: 'AM · empty stomach',
      priority: ferritin.value < 20 ? 'critical' : 'recommended',
      linkedMarker: 'Ferritin',
      markerValue: ferritin.value,
      markerUnit: 'ng/mL',
      rationale: `Ferritin at ${ferritin.value} ng/mL — suboptimal iron stores. Bisglycinate form minimizes GI distress.`,
    });
  }

  const crp = markers.find(m => m.id === 'crp');
  if (crp && crp.value !== null && crp.value > 1.0) {
    actions.push({
      id: 'omega3-epa',
      action: 'HIGH-DOSE EPA OMEGA-3',
      dosage: '2g EPA / 1g DHA',
      timing: 'Split · AM & PM with meals',
      priority: crp.value > 3.0 ? 'critical' : 'recommended',
      linkedMarker: 'hs-CRP',
      markerValue: crp.value,
      markerUnit: 'mg/L',
      rationale: `hs-CRP at ${crp.value} mg/L — systemic inflammation detected. EPA shown to reduce CRP by 30%.`,
    });
  }

  const hba1c = markers.find(m => m.id === 'hba1c');
  if (hba1c && hba1c.value !== null && hba1c.value > 5.6) {
    actions.push({
      id: 'berberine',
      action: 'BERBERINE HCL',
      dosage: '500mg',
      timing: 'With meals · 2-3x daily',
      priority: hba1c.value > 6.0 ? 'critical' : 'recommended',
      linkedMarker: 'HbA1c',
      markerValue: hba1c.value,
      markerUnit: '%',
      rationale: `HbA1c at ${hba1c.value}% — glucose dysregulation. Berberine shown to improve insulin sensitivity.`,
    });
  }

  if (hrvCurrent > 0 && hrvCurrent < 45) {
    actions.push({
      id: 'mag-threonate',
      action: 'MAGNESIUM L-THREONATE',
      dosage: '2g (144mg elemental)',
      timing: 'PM · 1hr before bed',
      priority: hrvCurrent < 30 ? 'critical' : 'advisory',
      linkedMarker: 'HRV',
      markerValue: hrvCurrent,
      markerUnit: 'ms',
      rationale: `HRV at ${hrvCurrent}ms — autonomic stress. Threonate crosses BBB for parasympathetic support.`,
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: 'maintenance',
      action: 'MAINTAIN CURRENT STACK',
      dosage: 'As prescribed',
      timing: 'Per existing schedule',
      priority: 'advisory',
      linkedMarker: 'All Markers',
      markerValue: null,
      markerUnit: '',
      rationale: 'All biomarkers within optimal range. Continue current supplementation protocol.',
    });
  }

  return actions.sort((a, b) => {
    const order = { critical: 0, recommended: 1, advisory: 2 };
    return order[a.priority] - order[b.priority];
  });
}

/* ── Decrypting text effect ── */
function DecryptText({ text, delay = 0 }: { text: string; delay?: number }) {
  const [display, setDisplay] = useState('');
  const [done, setDone] = useState(false);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let frame = 0;
    const maxFrames = text.length * 3;

    timeout = setTimeout(() => {
      const iv = setInterval(() => {
        frame++;
        const resolved = Math.floor(frame / 3);
        let out = '';
        for (let i = 0; i < text.length; i++) {
          if (i < resolved) {
            out += text[i];
          } else if (text[i] === ' ') {
            out += ' ';
          } else {
            out += chars[Math.floor(Math.random() * chars.length)];
          }
        }
        setDisplay(out);
        if (frame >= maxFrames) {
          clearInterval(iv);
          setDisplay(text);
          setDone(true);
        }
      }, 25);
      return () => clearInterval(iv);
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, delay]);

  return (
    <span style={{ opacity: done ? 1 : 0.7, transition: 'opacity 0.3s' }}>
      {display || text}
    </span>
  );
}

/* ── Scan progress bar ── */
function ScanBar({ active }: { active: boolean }) {
  return (
    <div className="w-full h-[1px] relative overflow-hidden" style={{ background: 'rgba(0,240,255,0.04)' }}>
      {active && (
        <div
          className="absolute top-0 left-0 h-full"
          style={{
            width: '40%',
            background: 'linear-gradient(90deg, transparent, rgba(0,255,204,0.4), transparent)',
            animation: 'protgenScan 2.5s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
}

/* ── Main Component ── */
export interface ProtocolGeneratorProps {
  vitaminD?: number | null;
  ferritin?: number | null;
  crp?: number | null;
  hba1c?: number | null;
  cortisol?: number | null;
  hrvCurrent?: number;
}

export function ProtocolGenerator({
  vitaminD = null,
  ferritin = null,
  crp = null,
  hba1c = null,
  cortisol = null,
  hrvCurrent = 0,
}: ProtocolGeneratorProps) {
  const [mounted, setMounted] = useState(false);
  const [scanning, setScanning] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Periodic re-scan pulse
  useEffect(() => {
    const iv = setInterval(() => {
      setScanning(false);
      setTimeout(() => setScanning(true), 300);
    }, 15000);
    return () => clearInterval(iv);
  }, []);

  const markers: BioMarker[] = useMemo(() => [
    { id: 'vitaminD', label: 'VIT-D', value: vitaminD, unit: 'ng/mL', optimalRange: [40, 60] as [number, number], status: evaluateMarker(vitaminD, [40, 60]) },
    { id: 'ferritin', label: 'FERR', value: ferritin, unit: 'ng/mL', optimalRange: [40, 150] as [number, number], status: evaluateMarker(ferritin, [40, 150]) },
    { id: 'crp', label: 'hs-CRP', value: crp, unit: 'mg/L', optimalRange: [0, 1.0] as [number, number], status: evaluateMarker(crp, [0, 1.0], true) },
    { id: 'hba1c', label: 'HbA1c', value: hba1c, unit: '%', optimalRange: [4.0, 5.6] as [number, number], status: evaluateMarker(hba1c, [4.0, 5.6], true) },
  ], [vitaminD, ferritin, crp, hba1c]);

  const actions = useMemo(
    () => deriveActions(markers, hrvCurrent, cortisol),
    [markers, hrvCurrent, cortisol],
  );

  const criticalCount = actions.filter(a => a.priority === 'critical').length;
  const hasActions = actions.length > 0 && actions[0].id !== 'maintenance';
  const statusColor = criticalCount > 0 ? '#FF6B6B' : hasActions ? '#FFB86B' : '#00FFCC';

  const STATUS_COLORS: Record<string, string> = {
    optimal: '#00FFCC',
    suboptimal: '#FFB86B',
    deficient: '#FF6B6B',
    elevated: '#FF6B6B',
    unknown: 'rgba(0,240,255,0.2)',
  };

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  return (
    <div
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}
    >
      {/* ── HEADER ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ filter: 'drop-shadow(0 0 4px rgba(0,240,255,0.3))' }}>
            <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0-4h18" stroke="rgba(0,240,255,0.6)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span
            className="text-[11px] tracking-[3px] uppercase font-mono"
            style={{ color: 'rgba(0,240,255,0.5)' }}
          >
            Optimal Protocol
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Pulsing green dot */}
          <div className="relative">
            <div
              className="w-2 h-2 rounded-full"
              style={{
                background: statusColor,
                boxShadow: `0 0 8px ${statusColor}66`,
                animation: 'protgenPulse 2s ease-in-out infinite',
              }}
            />
          </div>
          <span
            className="text-[9px] tracking-[2px] uppercase font-mono"
            style={{ color: statusColor, textShadow: `0 0 6px ${statusColor}33` }}
          >
            STATUS: OPTIMIZING
          </span>
        </div>
      </div>

      <ScanBar active={scanning} />

      {/* ── MARKER READOUT STRIP ── */}
      <div
        className="mx-4 mt-3 mb-3 px-3 py-2.5 rounded-lg flex items-center justify-between gap-1"
        style={{
          background: 'rgba(0,240,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {markers.map((m) => {
          const color = STATUS_COLORS[m.status];
          return (
            <div key={m.id} className="flex flex-col items-center min-w-[48px]">
              <span className="text-[7px] tracking-[2px] uppercase font-mono" style={{ color: 'rgba(0,240,255,0.3)' }}>
                {m.label}
              </span>
              <span
                className="text-[13px] tabular-nums font-bold font-mono"
                style={{ color, textShadow: m.status !== 'unknown' ? `0 0 6px ${color}44` : 'none' }}
              >
                {m.value !== null ? m.value : '--'}
              </span>
              <span className="text-[7px] font-mono" style={{ color: 'rgba(0,240,255,0.2)' }}>
                {m.value !== null ? m.unit : 'ANALYZING...'}
              </span>
            </div>
          );
        })}
        {/* HRV inline */}
        <div className="flex flex-col items-center min-w-[48px]">
          <span className="text-[7px] tracking-[2px] uppercase font-mono" style={{ color: 'rgba(0,240,255,0.3)' }}>HRV</span>
          <span
            className="text-[13px] tabular-nums font-bold font-mono"
            style={{
              color: hrvCurrent > 0 ? (hrvCurrent < 45 ? '#FF6B6B' : '#00FFCC') : 'rgba(0,240,255,0.2)',
              textShadow: hrvCurrent > 0 ? `0 0 6px ${hrvCurrent < 45 ? '#FF6B6B' : '#00FFCC'}44` : 'none',
            }}
          >
            {hrvCurrent > 0 ? hrvCurrent : '--'}
          </span>
          <span className="text-[7px] font-mono" style={{ color: 'rgba(0,240,255,0.2)' }}>
            {hrvCurrent > 0 ? 'ms' : 'ANALYZING...'}
          </span>
        </div>
      </div>

      {/* ── ACTION TABLE ── */}
      <div className="px-3 pb-2">
        {/* Column headers */}
        <div className="flex items-center gap-2 px-3 py-1.5 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="text-[8px] tracking-[2px] uppercase font-mono flex-1" style={{ color: 'rgba(0,240,255,0.3)', minWidth: 0 }}>
            ACTION
          </span>
          <span className="text-[8px] tracking-[2px] uppercase font-mono w-[72px] text-center" style={{ color: 'rgba(0,240,255,0.3)' }}>
            DOSAGE
          </span>
          <span className="text-[8px] tracking-[2px] uppercase font-mono w-[100px] text-right" style={{ color: 'rgba(0,240,255,0.3)' }}>
            TIMING
          </span>
        </div>

        {/* Action rows */}
        {actions.map((a, i) => {
          const pColor = PRIORITY_COLORS[a.priority];
          const isExpanded = expandedId === a.id;

          return (
            <button
              key={a.id}
              onClick={() => toggleExpand(a.id)}
              className="w-full text-left rounded-lg overflow-hidden mb-1 group"
              style={{
                background: a.priority === 'critical' ? 'rgba(255,107,107,0.03)' : 'rgba(0,240,255,0.015)',
                border: `1px solid ${a.priority === 'critical' ? 'rgba(255,107,107,0.08)' : 'rgba(255,255,255,0.04)'}`,
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateX(0)' : 'translateX(-6px)',
                transition: `all 0.3s ease ${i * 0.05}s`,
              }}
            >
              {/* Main row */}
              <div className="flex items-center gap-2 px-3 py-2.5">
                {/* Priority pip */}
                <div
                  className="w-1 h-7 rounded-full flex-shrink-0"
                  style={{
                    background: `linear-gradient(180deg, ${pColor}, ${pColor}44)`,
                    boxShadow: `0 0 4px ${pColor}33`,
                  }}
                />

                {/* Action label */}
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-mono leading-tight block truncate" style={{ color: 'rgba(224,220,216,0.9)' }}>
                    <DecryptText text={a.action} delay={i * 80} />
                  </span>
                  <span className="text-[8px] font-mono block mt-0.5" style={{ color: `${pColor}99` }}>
                    {a.linkedMarker}: {a.markerValue !== null ? `${a.markerValue} ${a.markerUnit}` : 'PENDING'}
                  </span>
                </div>

                {/* Dosage */}
                <span
                  className="text-[10px] font-mono font-bold w-[72px] text-center px-1.5 py-0.5 rounded flex-shrink-0"
                  style={{
                    color: pColor,
                    background: `${pColor}0D`,
                    border: `1px solid ${pColor}18`,
                  }}
                >
                  {a.dosage}
                </span>

                {/* Timing */}
                <span className="text-[9px] font-mono w-[100px] text-right truncate flex-shrink-0" style={{ color: 'rgba(0,240,255,0.4)' }}>
                  {a.timing}
                </span>

                {/* Expand */}
                <svg
                  width="10" height="10" viewBox="0 0 24 24" fill="none"
                  className="flex-shrink-0 ml-1"
                  style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }}
                >
                  <path d="M6 9l6 6 6-6" stroke="rgba(0,240,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* Expanded rationale */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                  <div className="flex items-start gap-2 mt-1.5">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="10" stroke="rgba(0,240,255,0.3)" strokeWidth="1.5" />
                      <path d="M12 16v-4M12 8h.01" stroke="rgba(0,240,255,0.4)" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    <span className="text-[10px] font-mono leading-relaxed" style={{ color: 'rgba(0,240,255,0.45)' }}>
                      {a.rationale}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span
                      className="text-[8px] tracking-[1.5px] uppercase font-mono px-2 py-0.5 rounded"
                      style={{ color: `${pColor}BB`, background: `${pColor}0A`, border: `1px solid ${pColor}15` }}
                    >
                      {a.priority}
                    </span>
                    <span className="text-[8px] font-mono" style={{ color: 'rgba(0,240,255,0.25)' }}>
                      EVIDENCE: PEER-REVIEWED
                    </span>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── FOOTER ── */}
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="text-[9px] tracking-[2px] uppercase font-mono" style={{ color: 'rgba(0,240,255,0.25)' }}>
          {actions.length} action{actions.length !== 1 ? 's' : ''}
          {criticalCount > 0 ? ` · ${criticalCount} critical` : ''}
        </span>
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: scanning ? '#00FFCC' : 'rgba(0,240,255,0.15)',
              boxShadow: scanning ? '0 0 4px rgba(0,255,204,0.4)' : 'none',
              transition: 'all 0.3s',
            }}
          />
          <span className="text-[9px] tracking-[1.5px] uppercase font-mono" style={{ color: scanning ? 'rgba(0,255,204,0.5)' : 'rgba(0,240,255,0.2)', transition: 'color 0.3s' }}>
            {scanning ? 'ANALYZING' : 'STANDBY'}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes protgenScan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @keyframes protgenPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

export default ProtocolGenerator;
