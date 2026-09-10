import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

/* ══════════════════════════════════════════════════════════════════════
   GHOST TREND OVERLAY
   
   Renders a futuristic, faint "ghost" projection line on top of any
   biomarker chart. The ghost trend shows where a biomarker is heading
   over the next 7 days based on current ProtocolStack adherence.
   
   Visual language:
   • Dashed line with animated dash offset (flowing motion)
   • Pulsing glow aura that breathes
   • Gradient opacity: solid near "today", fading to ghostly at day 7
   • Confidence cone: faint triangular spread showing uncertainty
   • Terminal dot with ripple animation
   ══════════════════════════════════════════════════════════════════════ */

/* ── Design Tokens ── */
const G = {
  ghostCyan: '#22d3ee',
  ghostCyanGlow: 'rgba(34,211,238,0.35)',
  ghostCyanFaint: 'rgba(34,211,238,0.08)',
  ghostGreen: '#4ade80',
  ghostGreenGlow: 'rgba(74,222,128,0.35)',
  ghostAmber: '#fbbf24',
  ghostAmberGlow: 'rgba(251,191,36,0.30)',
  ghostRose: '#f87171',
  ghostRoseGlow: 'rgba(248,113,113,0.30)',
  ghostViolet: '#a78bfa',
  ghostVioletGlow: 'rgba(167,139,250,0.30)',
  textGhost: 'rgba(255,255,255,0.35)',
  textGhostBright: 'rgba(255,255,255,0.55)',
  coneFill: 'rgba(34,211,238,0.04)',
};

/* ── Keyframes injected once ── */
const GHOST_KEYFRAMES = `
@keyframes ghostDashFlow {
  0% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -24; }
}
@keyframes ghostPulseGlow {
  0%, 100% { opacity: 0.3; filter: blur(4px); }
  50% { opacity: 0.6; filter: blur(6px); }
}
@keyframes ghostTerminalRipple {
  0% { r: 3; opacity: 0.8; }
  50% { r: 7; opacity: 0.15; }
  100% { r: 12; opacity: 0; }
}
@keyframes ghostFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes ghostLabelFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
`;

export interface GhostTrendConfig {
  /** Marker key matching bioForecast projection keys */
  markerKey: string;
  /** Display label */
  label: string;
  /** Primary ghost color */
  color: string;
  /** Glow color */
  glowColor: string;
  /** Unit string */
  unit: string;
  /** Whether higher values are better */
  higherIsBetter: boolean;
}

/* ── Preset configs for common markers ── */
export const GHOST_PRESETS: Record<string, GhostTrendConfig> = {
  vitaminD: { markerKey: 'vitaminD', label: 'Vitamin D', color: G.ghostAmber, glowColor: G.ghostAmberGlow, unit: 'ng/mL', higherIsBetter: true },
  testosteroneTotal: { markerKey: 'testosteroneTotal', label: 'Total T', color: G.ghostGreen, glowColor: G.ghostGreenGlow, unit: 'ng/dL', higherIsBetter: true },
  testosteroneFree: { markerKey: 'testosteroneFree', label: 'Free T', color: G.ghostGreen, glowColor: G.ghostGreenGlow, unit: 'pg/mL', higherIsBetter: true },
  ferritin: { markerKey: 'ferritin', label: 'Ferritin', color: G.ghostAmber, glowColor: G.ghostAmberGlow, unit: 'ng/mL', higherIsBetter: true },
  crp: { markerKey: 'crp', label: 'hs-CRP', color: G.ghostRose, glowColor: G.ghostRoseGlow, unit: 'mg/L', higherIsBetter: false },
  hba1c: { markerKey: 'hba1c', label: 'HbA1c', color: G.ghostViolet, glowColor: G.ghostVioletGlow, unit: '%', higherIsBetter: false },
  composite: { markerKey: 'composite', label: 'Health Score', color: G.ghostCyan, glowColor: G.ghostCyanGlow, unit: 'pts', higherIsBetter: true },
};

/* ── Smooth path builder ── */
function buildGhostPath(
  points: Array<{ x: number; y: number }>,
): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/* ══════════════════════════════════════════════════════════════════
   GhostTrendLine — Single ghost projection line for one marker
   ══════════════════════════════════════════════════════════════════ */

interface GhostTrendLineProps {
  /** 8-point trajectory array (day 0 = current, day 7 = projected) */
  trajectory: number[];
  /** Current value (day 0) */
  current: number;
  /** Projected value (day 7) */
  projected: number;
  /** Direction of improvement */
  direction: 'improving' | 'stable' | 'declining';
  /** Config for this marker */
  config: GhostTrendConfig;
  /** SVG coordinate space */
  svgWidth: number;
  svgHeight: number;
  /** Where the ghost line starts (X coordinate of "today" on the parent chart) */
  startX: number;
  /** Y-axis mapping function: value → SVG Y coordinate */
  valueToY: (val: number) => number;
  /** Whether to show the confidence cone */
  showCone?: boolean;
  /** Whether to show the terminal label */
  showLabel?: boolean;
  /** Unique ID for SVG defs */
  id: string;
}

export function GhostTrendLine({
  trajectory,
  current,
  projected,
  direction,
  config,
  svgWidth,
  svgHeight,
  startX,
  valueToY,
  showCone = true,
  showLabel = true,
  id,
}: GhostTrendLineProps) {
  const [animReady, setAnimReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAnimReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Build ghost line coordinates
  const ghostPoints = useMemo(() => {
    if (trajectory.length < 2) return [];
    const endX = svgWidth - 16;
    const rangeX = endX - startX;
    return trajectory.map((val, i) => ({
      x: startX + (i / (trajectory.length - 1)) * rangeX,
      y: valueToY(val),
    }));
  }, [trajectory, startX, svgWidth, valueToY]);

  const ghostPath = useMemo(() => buildGhostPath(ghostPoints), [ghostPoints]);

  // Confidence cone: widens as we go further into the future
  const conePath = useMemo(() => {
    if (!showCone || ghostPoints.length < 2) return '';
    const uncertainty = Math.abs(projected - current) * 0.15;
    const topPoints = ghostPoints.map((p, i) => {
      const spread = (i / (ghostPoints.length - 1)) * uncertainty;
      return { x: p.x, y: valueToY(trajectory[i] + (config.higherIsBetter ? spread : -spread)) };
    });
    const bottomPoints = ghostPoints.map((p, i) => {
      const spread = (i / (ghostPoints.length - 1)) * uncertainty;
      return { x: p.x, y: valueToY(trajectory[i] - (config.higherIsBetter ? spread : -spread)) };
    });

    let d = `M ${topPoints[0].x},${topPoints[0].y}`;
    for (let i = 1; i < topPoints.length; i++) {
      d += ` L ${topPoints[i].x},${topPoints[i].y}`;
    }
    for (let i = bottomPoints.length - 1; i >= 0; i--) {
      d += ` L ${bottomPoints[i].x},${bottomPoints[i].y}`;
    }
    d += ' Z';
    return d;
  }, [showCone, ghostPoints, projected, current, config.higherIsBetter, trajectory, valueToY]);

  const lastPoint = ghostPoints[ghostPoints.length - 1];
  const delta = projected - current;
  const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
  const dirColor = direction === 'improving' ? config.color : direction === 'declining' ? G.ghostRose : G.textGhost;

  if (!animReady || ghostPoints.length < 2) return null;

  return (
    <g style={{ animation: 'ghostFadeIn 0.8s ease both' }}>
      {/* SVG Defs for this ghost line */}
      <defs>
        <linearGradient id={`ghost-grad-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={config.color} stopOpacity="0.7" />
          <stop offset="40%" stopColor={config.color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={config.color} stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={`ghost-glow-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={config.glowColor} stopOpacity="0.5" />
          <stop offset="100%" stopColor={config.glowColor} stopOpacity="0.05" />
        </linearGradient>
        <filter id={`ghost-blur-${id}`}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Confidence cone */}
      {conePath && (
        <path
          d={conePath}
          fill={config.color}
          opacity={0.04}
          style={{ animation: 'ghostPulseGlow 4s ease-in-out infinite' }}
        />
      )}

      {/* Glow line (wider, blurred) */}
      <path
        d={ghostPath}
        fill="none"
        stroke={`url(#ghost-glow-${id})`}
        strokeWidth="6"
        strokeLinecap="round"
        style={{
          animation: 'ghostPulseGlow 3s ease-in-out infinite',
          filter: `url(#ghost-blur-${id})`,
        }}
      />

      {/* Main ghost line (dashed, animated flow) */}
      <path
        d={ghostPath}
        fill="none"
        stroke={`url(#ghost-grad-${id})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="8,4"
        style={{
          animation: 'ghostDashFlow 2s linear infinite',
        }}
      />

      {/* Thin inner line for crispness */}
      <path
        d={ghostPath}
        fill="none"
        stroke={config.color}
        strokeWidth="0.5"
        strokeLinecap="round"
        opacity={0.3}
      />

      {/* Start anchor dot */}
      <circle
        cx={ghostPoints[0].x}
        cy={ghostPoints[0].y}
        r={3}
        fill={config.color}
        opacity={0.6}
        stroke="rgba(0,0,0,0.4)"
        strokeWidth={1}
      />

      {/* Terminal dot with ripple */}
      {lastPoint && (
        <>
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={3}
            fill="rgba(0,0,0,0.5)"
            stroke={config.color}
            strokeWidth={1.5}
          />
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            fill="none"
            stroke={config.color}
            strokeWidth={0.8}
            opacity={0.4}
          >
            <animate attributeName="r" values="3;10;3" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0;0.5" dur="3s" repeatCount="indefinite" />
          </circle>

          {/* Terminal value label */}
          {showLabel && (
            <g style={{ animation: 'ghostLabelFloat 4s ease-in-out infinite' }}>
              <rect
                x={lastPoint.x - 28}
                y={lastPoint.y - 24}
                width={56}
                height={18}
                rx={6}
                fill="rgba(0,0,0,0.65)"
                stroke={config.color}
                strokeWidth={0.5}
                opacity={0.8}
              />
              <text
                x={lastPoint.x}
                y={lastPoint.y - 12}
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fontSize: 8,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fill: dirColor,
                  letterSpacing: '0.05em',
                }}
              >
                {deltaStr} {config.unit}
              </text>
            </g>
          )}
        </>
      )}

      {/* "PROJECTED" label at midpoint */}
      {ghostPoints.length >= 4 && (
        <text
          x={ghostPoints[Math.floor(ghostPoints.length / 2)].x}
          y={ghostPoints[Math.floor(ghostPoints.length / 2)].y - 14}
          textAnchor="middle"
          style={{
            fontSize: 6,
            fontFamily: 'monospace',
            fontWeight: 700,
            fill: config.color,
            opacity: 0.35,
            letterSpacing: '0.15em',
            textTransform: 'uppercase' as const,
          }}
        >
          7-DAY PROJECTION
        </text>
      )}
    </g>
  );
}

/* ══════════════════════════════════════════════════════════════════
   GhostTrendPanel — Standalone card showing all ghost projections
   ══════════════════════════════════════════════════════════════════ */

interface GhostTrendPanelProps {
  sessionId: string;
  className?: string;
  /** Which markers to show. Defaults to all available. */
  markers?: string[];
}

export default function GhostTrendPanel({
  sessionId,
  className = '',
  markers,
}: GhostTrendPanelProps) {
  const forecast = useQuery(
    api.bioForecast.getPredictiveForecast,
    sessionId ? { sessionId } : 'skip',
  );

  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Filter projections to requested markers
  const projections = useMemo(() => {
    if (!forecast?.projections) return [];
    const available = forecast.projections;
    if (markers) return available.filter(p => markers.includes(p.key));
    return available;
  }, [forecast, markers]);

  // Auto-select first marker
  useEffect(() => {
    if (projections.length > 0 && !selectedMarker) {
      setSelectedMarker(projections[0].key);
    }
  }, [projections, selectedMarker]);

  const activeProjection = projections.find(p => p.key === selectedMarker);

  // SVG dimensions
  const W = 480;
  const H = 200;
  const PAD = { top: 24, bottom: 32, left: 44, right: 24 };

  // Value-to-Y mapping for the active projection
  const { valueToY, minVal, maxVal } = useMemo(() => {
    if (!activeProjection) return { valueToY: () => 0, minVal: 0, maxVal: 100 };
    const vals = activeProjection.trajectory;
    const mn = Math.min(...vals) * 0.92;
    const mx = Math.max(...vals) * 1.08;
    const drawH = H - PAD.top - PAD.bottom;
    const range = mx - mn || 1;
    return {
      valueToY: (v: number) => PAD.top + drawH - ((v - mn) / range) * drawH,
      minVal: mn,
      maxVal: mx,
    };
  }, [activeProjection]);

  // Mouse tracking
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !activeProjection) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scaleX = W / rect.width;
    const svgX = x * scaleX;
    const drawW = W - PAD.left - PAD.right;
    const idx = Math.round(((svgX - PAD.left) / drawW) * (activeProjection.trajectory.length - 1));
    setHoveredDay(Math.max(0, Math.min(activeProjection.trajectory.length - 1, idx)));
  }, [activeProjection]);

  const config = selectedMarker ? (GHOST_PRESETS[selectedMarker] || GHOST_PRESETS.composite) : GHOST_PRESETS.composite;

  if (!forecast || !forecast.hasData) {
    return (
      <div className={`relative rounded-2xl border border-white/[0.06] bg-black/50 backdrop-blur-xl p-5 ${className}`}>
        <style>{GHOST_KEYFRAMES}</style>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${G.ghostCyan}12` }}>
            <span className="text-sm">👻</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wide" style={{ color: G.textGhostBright }}>GHOST TREND</h3>
            <p className="text-[9px] uppercase tracking-widest" style={{ color: G.textGhost }}>7-Day Bio-Projection</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-10">
          <p className="text-[11px] text-center max-w-[220px]" style={{ color: G.textGhost }}>
            Log biomarkers and complete protocols to unlock predictive ghost trends.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-2xl border border-white/[0.06] bg-black/50 backdrop-blur-xl overflow-hidden ${className}`}>
      <style>{GHOST_KEYFRAMES}</style>

      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 50% 40% at 60% 50%, ${config.glowColor.replace('0.3', '0.06')}, transparent)`,
        }}
      />

      {/* Header */}
      <div className="relative z-10 px-5 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center relative"
              style={{ background: `${config.color}12`, border: `1px solid ${config.color}20` }}
            >
              <span className="text-sm">👻</span>
              <div
                className="absolute inset-0 rounded-lg"
                style={{ animation: 'ghostPulseGlow 3s ease-in-out infinite', background: `${config.color}08` }}
              />
            </div>
            <div>
              <h3 className="text-[13px] font-bold tracking-wide" style={{ color: 'rgba(255,255,255,0.85)' }}>
                GHOST TREND
              </h3>
              <p className="text-[9px] uppercase tracking-widest" style={{ color: G.textGhost }}>
                7-Day Bio-Projection
              </p>
            </div>
          </div>

          {/* Adherence badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
            style={{
              background: forecast.avg7dAdherence >= 70 ? 'rgba(74,222,128,0.12)' : forecast.avg7dAdherence >= 40 ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)',
              border: `1px solid ${forecast.avg7dAdherence >= 70 ? 'rgba(74,222,128,0.25)' : forecast.avg7dAdherence >= 40 ? 'rgba(251,191,36,0.25)' : 'rgba(248,113,113,0.25)'}`,
            }}
          >
            <span className="text-[8px] font-mono font-bold tracking-wider" style={{
              color: forecast.avg7dAdherence >= 70 ? G.ghostGreen : forecast.avg7dAdherence >= 40 ? G.ghostAmber : G.ghostRose,
            }}>
              {forecast.avg7dAdherence}% ADHERENCE
            </span>
          </div>
        </div>

        {/* Marker selector pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {projections.map(p => {
            const preset = GHOST_PRESETS[p.key] || GHOST_PRESETS.composite;
            const isActive = selectedMarker === p.key;
            return (
              <button
                key={p.key}
                onClick={() => { setSelectedMarker(p.key); setHoveredDay(null); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg whitespace-nowrap transition-all duration-200"
                style={{
                  background: isActive ? `${preset.color}18` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? `${preset.color}35` : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: preset.color, boxShadow: isActive ? `0 0 6px ${preset.glowColor}` : 'none' }}
                />
                <span className="text-[9px] font-mono font-semibold" style={{
                  color: isActive ? preset.color : G.textGhost,
                }}>
                  {p.label}
                </span>
                <span className="text-[8px] font-mono" style={{
                  color: p.direction === 'improving' ? G.ghostGreen : p.direction === 'declining' ? G.ghostRose : G.textGhost,
                }}>
                  {p.direction === 'improving' ? '↑' : p.direction === 'declining' ? '↓' : '→'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ghost Chart */}
      <div className="relative px-3 pb-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 200 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredDay(null)}
        >
          <defs>
            <linearGradient id="ghost-panel-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(34,211,238,0.03)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>

          {/* Subtle grid */}
          {[0, 1, 2, 3, 4].map(i => {
            const y = PAD.top + ((H - PAD.top - PAD.bottom) / 4) * i;
            const val = maxVal - ((maxVal - minVal) / 4) * i;
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                  stroke="rgba(255,255,255,0.04)" strokeWidth="0.5"
                />
                <text
                  x={PAD.left - 6} y={y}
                  textAnchor="end" dominantBaseline="central"
                  style={{ fontSize: 7, fontFamily: 'monospace', fill: 'rgba(255,255,255,0.2)' }}
                >
                  {val.toFixed(val < 10 ? 1 : 0)}
                </text>
              </g>
            );
          })}

          {/* Day labels */}
          {activeProjection && [0, 1, 2, 3, 4, 5, 6, 7].map(d => {
            const drawW = W - PAD.left - PAD.right;
            const x = PAD.left + (d / 7) * drawW;
            return (
              <text
                key={`day-${d}`}
                x={x} y={H - 8}
                textAnchor="middle"
                style={{
                  fontSize: 7, fontFamily: 'monospace',
                  fill: d === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
                  fontWeight: d === 0 ? 700 : 400,
                }}
              >
                {d === 0 ? 'NOW' : `D+${d}`}
              </text>
            );
          })}

          {/* "TODAY" divider line */}
          <line
            x1={PAD.left} y1={PAD.top}
            x2={PAD.left} y2={H - PAD.bottom}
            stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="3,3"
          />
          <text
            x={PAD.left + 4} y={PAD.top + 8}
            style={{ fontSize: 6, fontFamily: 'monospace', fill: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em' }}
          >
            TODAY
          </text>

          {/* Ghost trend line */}
          {activeProjection && (
            <GhostTrendLine
              trajectory={activeProjection.trajectory}
              current={activeProjection.current}
              projected={activeProjection.projected}
              direction={activeProjection.direction}
              config={config}
              svgWidth={W}
              svgHeight={H}
              startX={PAD.left}
              valueToY={valueToY}
              showCone={true}
              showLabel={true}
              id={`panel-${activeProjection.key}`}
            />
          )}

          {/* Hover crosshair */}
          {hoveredDay !== null && activeProjection && (
            <g>
              <line
                x1={PAD.left + (hoveredDay / (activeProjection.trajectory.length - 1)) * (W - PAD.left - PAD.right)}
                y1={PAD.top}
                x2={PAD.left + (hoveredDay / (activeProjection.trajectory.length - 1)) * (W - PAD.left - PAD.right)}
                y2={H - PAD.bottom}
                stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" strokeDasharray="2,2"
              />
              <circle
                cx={PAD.left + (hoveredDay / (activeProjection.trajectory.length - 1)) * (W - PAD.left - PAD.right)}
                cy={valueToY(activeProjection.trajectory[hoveredDay])}
                r={4}
                fill={config.color}
                stroke="rgba(0,0,0,0.5)"
                strokeWidth={1.5}
              />
            </g>
          )}
        </svg>

        {/* Hover tooltip */}
        {hoveredDay !== null && activeProjection && (
          <div
            className="absolute pointer-events-none z-20"
            style={{
              top: 24,
              left: `${((PAD.left + (hoveredDay / (activeProjection.trajectory.length - 1)) * (W - PAD.left - PAD.right)) / W) * 100}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div
              className="rounded-lg px-3 py-2"
              style={{
                background: 'rgba(0,0,0,0.85)',
                border: `1px solid ${config.color}30`,
                backdropFilter: 'blur(12px)',
              }}
            >
              <div className="text-[7px] font-mono tracking-wider mb-1" style={{ color: G.textGhost }}>
                {hoveredDay === 0 ? 'CURRENT' : `DAY +${hoveredDay}`}
              </div>
              <div className="text-[13px] font-mono font-bold" style={{ color: config.color }}>
                {activeProjection.trajectory[hoveredDay].toFixed(1)} {config.unit}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Insights footer */}
      {forecast.insights.length > 0 && (
        <div className="px-5 pb-4">
          <div
            className="rounded-lg px-3 py-2"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div className="flex items-start gap-2">
              <span className="text-[10px] mt-0.5">{forecast.insights[0].icon}</span>
              <p className="text-[10px] leading-relaxed" style={{ color: G.textGhostBright }}>
                {forecast.insights[0].text}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Composite score footer */}
      <div className="px-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-mono tracking-wider" style={{ color: G.textGhost }}>CURRENT</span>
            <span className="text-[14px] font-mono font-black" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {forecast.currentComposite}
            </span>
          </div>
          <svg width="16" height="8" viewBox="0 0 16 8">
            <path d="M0,4 L12,4 M10,1 L14,4 L10,7" fill="none" stroke={config.color} strokeWidth="1" opacity="0.4" />
          </svg>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-mono tracking-wider" style={{ color: G.textGhost }}>PROJECTED</span>
            <span className="text-[14px] font-mono font-black" style={{
              color: forecast.compositeDelta >= 0 ? G.ghostGreen : G.ghostRose,
              textShadow: `0 0 8px ${forecast.compositeDelta >= 0 ? G.ghostGreenGlow : G.ghostRoseGlow}`,
            }}>
              {forecast.projectedComposite}
            </span>
          </div>
        </div>
        <div
          className="px-2 py-1 rounded-full"
          style={{
            background: forecast.compositeDelta >= 0 ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
            border: `1px solid ${forecast.compositeDelta >= 0 ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
          }}
        >
          <span className="text-[9px] font-mono font-bold" style={{
            color: forecast.compositeDelta >= 0 ? G.ghostGreen : G.ghostRose,
          }}>
            {forecast.compositeDelta >= 0 ? '+' : ''}{forecast.compositeDelta} pts
          </span>
        </div>
      </div>
    </div>
  );
}
