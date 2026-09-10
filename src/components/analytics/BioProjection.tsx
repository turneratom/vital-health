import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

/* ══════════════════════════════════════════════════════════════════════
   BIO-PROJECTION — Split Path Visualization
   
   Two lines diverge in a dark canvas:
   • SOLID: "Current Trajectory" — last 14 days of actual compliance
   • GLOWING DOTTED: "Optimized Trajectory" — projected if 100% adherent
   
   The gap between them is the cost of inaction, rendered as a
   gradient fill that grows wider as compliance drops.
   ══════════════════════════════════════════════════════════════════════ */

interface BioProjectionProps {
  sessionId: string;
  className?: string;
  /** Which biomarker to project. Defaults to composite "Health Score" */
  marker?: 'composite' | 'vitaminD' | 'crp' | 'hba1c' | 'testosterone' | 'ferritin';
}

/* ── Marker display config ── */
const MARKER_CONFIG: Record<string, {
  label: string;
  unit: string;
  color: string;
  glowColor: string;
  optimalRange: [number, number];
  higherIsBetter: boolean;
  icon: string;
}> = {
  composite: {
    label: 'Health Score',
    unit: 'pts',
    color: '#22d3ee',
    glowColor: 'rgba(34,211,238,0.6)',
    optimalRange: [85, 100],
    higherIsBetter: true,
    icon: '⚡',
  },
  vitaminD: {
    label: 'Vitamin D',
    unit: 'ng/mL',
    color: '#fbbf24',
    glowColor: 'rgba(251,191,36,0.6)',
    optimalRange: [50, 80],
    higherIsBetter: true,
    icon: '☀️',
  },
  crp: {
    label: 'hs-CRP',
    unit: 'mg/L',
    color: '#f87171',
    glowColor: 'rgba(248,113,113,0.6)',
    optimalRange: [0, 1],
    higherIsBetter: false,
    icon: '🔥',
  },
  hba1c: {
    label: 'HbA1c',
    unit: '%',
    color: '#a78bfa',
    glowColor: 'rgba(167,139,250,0.6)',
    optimalRange: [4.5, 5.4],
    higherIsBetter: false,
    icon: '🩸',
  },
  testosterone: {
    label: 'Testosterone',
    unit: 'ng/dL',
    color: '#4ade80',
    glowColor: 'rgba(74,222,128,0.6)',
    optimalRange: [600, 900],
    higherIsBetter: true,
    icon: '💪',
  },
  ferritin: {
    label: 'Ferritin',
    unit: 'ng/mL',
    color: '#fb923c',
    glowColor: 'rgba(251,146,60,0.6)',
    optimalRange: [80, 200],
    higherIsBetter: true,
    icon: '🧲',
  },
};

/* ── Projection math ── */
function projectTrajectory(
  dailyRates: Array<{ date: string; rate: number }>,
  currentValue: number,
  optimalRange: [number, number],
  higherIsBetter: boolean,
  projectionDays: number = 14,
): { current: number[]; optimized: number[]; dates: string[]; gapPercent: number } {
  const rates = dailyRates.slice(-14);
  const avgCompliance = rates.length > 0
    ? rates.reduce((s, r) => s + r.rate, 0) / rates.length / 100
    : 0.5;

  // Build historical points (last 14 days)
  const historicalPoints: number[] = [];
  const allDates: string[] = [];

  // Simulate historical trajectory based on daily compliance
  let val = currentValue;
  const optimalMid = (optimalRange[0] + optimalRange[1]) / 2;
  const distFromOptimal = Math.abs(val - optimalMid);
  const maxDailyImprovement = distFromOptimal * 0.012; // ~1.2% per day at 100%

  // Walk backwards to estimate where we were 14 days ago
  const startVal = higherIsBetter
    ? val - (avgCompliance * maxDailyImprovement * rates.length * 0.7)
    : val + (avgCompliance * maxDailyImprovement * rates.length * 0.7);

  for (let i = 0; i < rates.length; i++) {
    const dayRate = (rates[i]?.rate ?? 50) / 100;
    const progress = i / Math.max(1, rates.length - 1);
    const historicalVal = startVal + (val - startVal) * progress;

    // Add daily noise based on compliance variance
    const noise = (Math.sin(i * 2.7 + 0.3) * 0.5 + Math.cos(i * 1.3) * 0.3) * maxDailyImprovement * 0.4;
    const dayVal = historicalVal + noise * (dayRate > 0.5 ? 1 : -1);

    historicalPoints.push(Math.round(dayVal * 100) / 100);
    allDates.push(rates[i]?.date ?? `day-${i}`);
  }

  // Project forward 14 days — two paths diverge
  const currentPath: number[] = [...historicalPoints];
  const optimizedPath: number[] = [...historicalPoints];

  let currentVal = val;
  let optimizedVal = val;

  for (let d = 1; d <= projectionDays; d++) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + d);
    allDates.push(futureDate.toISOString().slice(0, 10));

    // Current trajectory: continues at current avg compliance
    const currentDelta = maxDailyImprovement * avgCompliance * (higherIsBetter ? 1 : -1);
    // Diminishing returns as you approach optimal
    const currentDistRatio = Math.abs(currentVal - optimalMid) / Math.max(1, distFromOptimal);
    currentVal += currentDelta * Math.max(0.2, currentDistRatio);
    // Add slight decay for low compliance
    if (avgCompliance < 0.6) {
      currentVal += (higherIsBetter ? -1 : 1) * maxDailyImprovement * 0.15;
    }
    currentPath.push(Math.round(currentVal * 100) / 100);

    // Optimized trajectory: 100% compliance
    const optDelta = maxDailyImprovement * 1.0 * (higherIsBetter ? 1 : -1);
    const optDistRatio = Math.abs(optimizedVal - optimalMid) / Math.max(1, distFromOptimal);
    optimizedVal += optDelta * Math.max(0.3, optDistRatio);
    optimizedPath.push(Math.round(optimizedVal * 100) / 100);
  }

  // Calculate the gap at the end as a percentage
  const finalCurrent = currentPath[currentPath.length - 1];
  const finalOptimized = optimizedPath[optimizedPath.length - 1];
  const gapPercent = Math.abs(
    ((finalOptimized - finalCurrent) / Math.max(1, Math.abs(finalCurrent))) * 100
  );

  return {
    current: currentPath,
    optimized: optimizedPath,
    dates: allDates,
    gapPercent: Math.round(gapPercent * 10) / 10,
  };
}

/* ── SVG Path builder with smooth curves ── */
function buildSmoothPath(
  points: number[],
  width: number,
  height: number,
  padding: { top: number; bottom: number; left: number; right: number },
  minVal: number,
  maxVal: number,
): string {
  if (points.length < 2) return '';

  const drawW = width - padding.left - padding.right;
  const drawH = height - padding.top - padding.bottom;
  const range = maxVal - minVal || 1;

  const coords = points.map((v, i) => ({
    x: padding.left + (i / (points.length - 1)) * drawW,
    y: padding.top + drawH - ((v - minVal) / range) * drawH,
  }));

  let d = `M ${coords[0].x},${coords[0].y}`;

  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(0, i - 1)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(coords.length - 1, i + 2)];

    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return d;
}

/* ── Main Component ── */
export default function BioProjection({
  sessionId,
  className = '',
  marker = 'composite',
}: BioProjectionProps) {
  const adherenceData = useQuery(api.correlationEngine.getProtocolAdherenceHistory, {
    sessionId,
    days: 14,
  });

  const [selectedMarker, setSelectedMarker] = useState(marker);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [animProgress, setAnimProgress] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Animate in
  useEffect(() => {
    let frame: number;
    let start: number | null = null;
    const duration = 1800;

    const animate = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimProgress(eased);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [selectedMarker]);

  const config = MARKER_CONFIG[selectedMarker];

  // Build projection data
  const projection = useMemo(() => {
    if (!adherenceData) return null;

    const dailyRates = adherenceData.dailyRates ?? [];
    const vault = adherenceData.bioVault;

    // Get current value from vault or use sensible defaults
    let currentValue: number;
    switch (selectedMarker) {
      case 'vitaminD':
        currentValue = vault?.vitaminD ?? 35;
        break;
      case 'crp':
        currentValue = vault?.crp ?? 2.1;
        break;
      case 'hba1c':
        currentValue = vault?.hba1c ?? 5.6;
        break;
      case 'testosterone':
        currentValue = vault?.testosteroneTotal ?? 480;
        break;
      case 'ferritin':
        currentValue = vault?.ferritin ?? 65;
        break;
      default: {
        // Composite: derive from avg compliance
        const avg = adherenceData.avgDailyRate ?? 50;
        currentValue = Math.round(avg * 0.85 + 15);
        break;
      }
    }

    return projectTrajectory(
      dailyRates,
      currentValue,
      config.optimalRange,
      config.higherIsBetter,
      14,
    );
  }, [adherenceData, selectedMarker, config]);

  // SVG dimensions
  const W = 560;
  const H = 280;
  const PAD = { top: 30, bottom: 40, left: 50, right: 20 };

  // Compute paths
  const { currentPath, optimizedPath, fillPath, minVal, maxVal, todayX } = useMemo(() => {
    if (!projection) return { currentPath: '', optimizedPath: '', fillPath: '', minVal: 0, maxVal: 100, todayX: 0 };

    const allVals = [...projection.current, ...projection.optimized];
    const mn = Math.min(...allVals) * 0.95;
    const mx = Math.max(...allVals) * 1.05;

    // Slice paths to animation progress
    const totalPts = projection.current.length;
    const visiblePts = Math.max(2, Math.round(totalPts * animProgress));

    const currentSlice = projection.current.slice(0, visiblePts);
    const optimizedSlice = projection.optimized.slice(0, visiblePts);

    const cp = buildSmoothPath(currentSlice, W, H, PAD, mn, mx);
    const op = buildSmoothPath(optimizedSlice, W, H, PAD, mn, mx);

    // Build fill area between the two paths (the "cost of inaction" gap)
    const drawW = W - PAD.left - PAD.right;
    const drawH = H - PAD.top - PAD.bottom;
    const range = mx - mn || 1;

    const topCoords = optimizedSlice.map((v, i) => ({
      x: PAD.left + (i / (totalPts - 1)) * drawW,
      y: PAD.top + drawH - ((v - mn) / range) * drawH,
    }));
    const bottomCoords = currentSlice.map((v, i) => ({
      x: PAD.left + (i / (totalPts - 1)) * drawW,
      y: PAD.top + drawH - ((v - mn) / range) * drawH,
    }));

    let fp = '';
    if (topCoords.length >= 2) {
      fp = `M ${topCoords[0].x},${topCoords[0].y}`;
      for (let i = 1; i < topCoords.length; i++) {
        fp += ` L ${topCoords[i].x},${topCoords[i].y}`;
      }
      for (let i = bottomCoords.length - 1; i >= 0; i--) {
        fp += ` L ${bottomCoords[i].x},${bottomCoords[i].y}`;
      }
      fp += ' Z';
    }

    // Today line X position (where historical ends and projection begins)
    const historicalLen = (adherenceData?.dailyRates?.length ?? 14);
    const tX = PAD.left + (historicalLen / (totalPts - 1)) * drawW;

    return { currentPath: cp, optimizedPath: op, fillPath: fp, minVal: mn, maxVal: mx, todayX: tX };
  }, [projection, animProgress, adherenceData, W, H, PAD]);

  // Mouse tracking for tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !projection) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scaleX = W / rect.width;
    const svgX = x * scaleX;

    const drawW = W - PAD.left - PAD.right;
    const idx = Math.round(((svgX - PAD.left) / drawW) * (projection.current.length - 1));
    const clamped = Math.max(0, Math.min(projection.current.length - 1, idx));
    setHoveredDay(clamped);
  }, [projection, W, PAD]);

  // Tooltip data
  const tooltip = useMemo(() => {
    if (hoveredDay === null || !projection) return null;
    const idx = hoveredDay;
    const currentVal = projection.current[idx];
    const optimizedVal = projection.optimized[idx];
    const date = projection.dates[idx];
    const isProjection = idx >= (adherenceData?.dailyRates?.length ?? 14);

    const drawW = W - PAD.left - PAD.right;
    const range = maxVal - minVal || 1;
    const drawH = H - PAD.top - PAD.bottom;

    const x = PAD.left + (idx / (projection.current.length - 1)) * drawW;
    const y = PAD.top + drawH - ((optimizedVal - minVal) / range) * drawH;

    return { currentVal, optimizedVal, date, isProjection, x, y };
  }, [hoveredDay, projection, adherenceData, W, H, PAD, minVal, maxVal]);

  const avgCompliance = adherenceData?.avgDailyRate ?? 0;

  // Marker selector pills
  const markerKeys = Object.keys(MARKER_CONFIG) as Array<keyof typeof MARKER_CONFIG>;

  if (!adherenceData) {
    return (
      <div className={`relative rounded-2xl border border-white/[0.06] bg-black/40 backdrop-blur-xl p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <span className="text-sm">📈</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/90 tracking-wide">BIO-PROJECTION</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Loading trajectory data...</p>
          </div>
        </div>
        <div className="h-[280px] flex items-center justify-center">
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-cyan-400/40"
                style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative rounded-2xl border border-white/[0.06] bg-black/40 backdrop-blur-xl overflow-hidden ${className}`}
    >
      {/* Ambient glow behind the chart */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 70% 60%, ${config.glowColor.replace('0.6', '0.08')}, transparent)`,
        }}
      />

      {/* Header */}
      <div className="relative z-10 px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
              style={{ background: config.color + '15' }}
            >
              {config.icon}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white/90 tracking-wide">
                BIO-PROJECTION
              </h3>
              <p className="text-[10px] text-white/40 uppercase tracking-[0.15em]">
                Split Path Analysis — {config.label}
              </p>
            </div>
          </div>

          {/* Gap indicator */}
          {projection && (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-[10px] text-white/30 uppercase tracking-wider">
                  Cost of Inaction
                </div>
                <div
                  className="text-lg font-bold tabular-nums"
                  style={{ color: projection.gapPercent > 10 ? '#f87171' : projection.gapPercent > 5 ? '#fbbf24' : '#4ade80' }}
                >
                  {projection.gapPercent > 0 ? '-' : ''}{projection.gapPercent}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Marker selector */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {markerKeys.map(mk => {
            const mc = MARKER_CONFIG[mk];
            const isActive = mk === selectedMarker;
            return (
              <button
                key={mk}
                onClick={() => { setSelectedMarker(mk as any); setAnimProgress(0); }}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium
                  transition-all duration-200 whitespace-nowrap shrink-0
                  ${isActive
                    ? 'text-white border border-white/20'
                    : 'text-white/40 border border-transparent hover:text-white/60 hover:border-white/10'
                  }
                `}
                style={isActive ? { background: mc.color + '18' } : {}}
              >
                <span className="text-xs">{mc.icon}</span>
                {mc.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="relative z-10 px-3 pb-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredDay(null)}
        >
          <defs>
            {/* Gap gradient fill */}
            <linearGradient id="gap-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.color} stopOpacity="0.12" />
              <stop offset="100%" stopColor={config.color} stopOpacity="0.02" />
            </linearGradient>

            {/* Optimized line glow */}
            <filter id="opt-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Dot glow */}
            <filter id="dot-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Dashed pattern for optimized line */}
            <pattern id="dash-pattern" patternUnits="userSpaceOnUse" width="12" height="1">
              <rect width="7" height="1" fill={config.color} opacity="0.9" />
            </pattern>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(pct => {
            const y = PAD.top + (H - PAD.top - PAD.bottom) * (1 - pct);
            const val = minVal + (maxVal - minVal) * pct;
            return (
              <g key={pct}>
                <line
                  x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                  stroke="rgba(255,255,255,0.04)" strokeWidth="1"
                />
                <text
                  x={PAD.left - 8} y={y + 3}
                  textAnchor="end"
                  className="text-[9px]"
                  fill="rgba(255,255,255,0.2)"
                >
                  {val < 10 ? val.toFixed(1) : Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* Optimal range band */}
          {(() => {
            const range = maxVal - minVal || 1;
            const drawH = H - PAD.top - PAD.bottom;
            const y1 = PAD.top + drawH - ((config.optimalRange[1] - minVal) / range) * drawH;
            const y2 = PAD.top + drawH - ((config.optimalRange[0] - minVal) / range) * drawH;
            return (
              <rect
                x={PAD.left} y={Math.max(PAD.top, y1)}
                width={W - PAD.left - PAD.right}
                height={Math.min(drawH, y2 - y1)}
                fill={config.color}
                opacity="0.04"
                rx="2"
              />
            );
          })()}

          {/* "Today" divider line */}
          <line
            x1={todayX} y1={PAD.top - 5}
            x2={todayX} y2={H - PAD.bottom + 5}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
          <text
            x={todayX} y={PAD.top - 10}
            textAnchor="middle"
            className="text-[9px] font-medium"
            fill="rgba(255,255,255,0.35)"
          >
            TODAY
          </text>

          {/* Gap fill between paths */}
          {fillPath && (
            <path
              d={fillPath}
              fill="url(#gap-fill)"
              opacity={animProgress}
            />
          )}

          {/* Current trajectory — solid line */}
          {currentPath && (
            <path
              d={currentPath}
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                strokeDasharray: 2000,
                strokeDashoffset: 2000 * (1 - animProgress),
                transition: 'stroke-dashoffset 0.05s linear',
              }}
            />
          )}

          {/* Optimized trajectory — glowing dotted line */}
          {optimizedPath && (
            <>
              {/* Glow layer */}
              <path
                d={optimizedPath}
                fill="none"
                stroke={config.glowColor}
                strokeWidth="4"
                strokeLinecap="round"
                filter="url(#opt-glow)"
                opacity={0.4 * animProgress}
                style={{
                  strokeDasharray: 2000,
                  strokeDashoffset: 2000 * (1 - animProgress),
                }}
              />
              {/* Main dotted line */}
              <path
                d={optimizedPath}
                fill="none"
                stroke={config.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="6,4"
                opacity={0.9 * animProgress}
                style={{
                  strokeDasharray: `6,4`,
                }}
              />
            </>
          )}

          {/* Endpoint dots */}
          {projection && animProgress > 0.95 && (
            <>
              {/* Current endpoint */}
              {(() => {
                const idx = projection.current.length - 1;
                const drawW = W - PAD.left - PAD.right;
                const drawH = H - PAD.top - PAD.bottom;
                const range = maxVal - minVal || 1;
                const x = PAD.left + (idx / (projection.current.length - 1)) * drawW;
                const y = PAD.top + drawH - ((projection.current[idx] - minVal) / range) * drawH;
                return (
                  <g>
                    <circle cx={x} cy={y} r="4" fill="rgba(255,255,255,0.5)" />
                    <circle cx={x} cy={y} r="2" fill="white" />
                  </g>
                );
              })()}
              {/* Optimized endpoint */}
              {(() => {
                const idx = projection.optimized.length - 1;
                const drawW = W - PAD.left - PAD.right;
                const drawH = H - PAD.top - PAD.bottom;
                const range = maxVal - minVal || 1;
                const x = PAD.left + (idx / (projection.optimized.length - 1)) * drawW;
                const y = PAD.top + drawH - ((projection.optimized[idx] - minVal) / range) * drawH;
                return (
                  <g filter="url(#dot-glow)">
                    <circle cx={x} cy={y} r="5" fill={config.color} opacity="0.6" />
                    <circle cx={x} cy={y} r="3" fill={config.color} />
                  </g>
                );
              })()}
            </>
          )}

          {/* Hover crosshair + tooltip */}
          {tooltip && (
            <>
              <line
                x1={tooltip.x} y1={PAD.top}
                x2={tooltip.x} y2={H - PAD.bottom}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="1"
              />
              {/* Current dot */}
              {(() => {
                const drawH = H - PAD.top - PAD.bottom;
                const range = maxVal - minVal || 1;
                const cy = PAD.top + drawH - ((tooltip.currentVal - minVal) / range) * drawH;
                return <circle cx={tooltip.x} cy={cy} r="3" fill="rgba(255,255,255,0.6)" />;
              })()}
              {/* Optimized dot */}
              <circle cx={tooltip.x} cy={tooltip.y} r="3.5" fill={config.color} />
            </>
          )}

          {/* X-axis date labels */}
          {projection && [0, Math.floor(projection.dates.length * 0.25), Math.floor(projection.dates.length * 0.5), Math.floor(projection.dates.length * 0.75), projection.dates.length - 1].map(idx => {
            const drawW = W - PAD.left - PAD.right;
            const x = PAD.left + (idx / (projection.dates.length - 1)) * drawW;
            const dateStr = projection.dates[idx];
            const formatted = dateStr ? new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
            return (
              <text
                key={idx}
                x={x} y={H - PAD.bottom + 18}
                textAnchor="middle"
                className="text-[9px]"
                fill="rgba(255,255,255,0.2)"
              >
                {formatted}
              </text>
            );
          })}
        </svg>

        {/* Floating tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-20"
            style={{
              left: `${(tooltip.x / W) * 100}%`,
              top: `${((tooltip.y - 10) / H) * 100}%`,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 shadow-xl">
              <div className="text-[9px] text-white/40 mb-1">
                {tooltip.date ? new Date(tooltip.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                {tooltip.isProjection && (
                  <span className="ml-1.5 text-cyan-400/60">PROJECTED</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-0.5 bg-white/40 rounded-full" />
                  <span className="text-[10px] text-white/50">Current</span>
                  <span className="text-[11px] text-white/80 font-medium tabular-nums">
                    {tooltip.currentVal < 10 ? tooltip.currentVal.toFixed(1) : Math.round(tooltip.currentVal)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-0.5 rounded-full" style={{ background: config.color }} />
                  <span className="text-[10px] text-white/50">Optimal</span>
                  <span className="text-[11px] font-medium tabular-nums" style={{ color: config.color }}>
                    {tooltip.optimizedVal < 10 ? tooltip.optimizedVal.toFixed(1) : Math.round(tooltip.optimizedVal)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend + Stats footer */}
      <div className="relative z-10 px-5 pb-4 pt-1">
        <div className="flex items-center justify-between">
          {/* Legend */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-[2px] bg-white/40 rounded-full" />
              <span className="text-[10px] text-white/40">Current Path</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-[2px] rounded-full" style={{ background: config.color, boxShadow: `0 0 6px ${config.glowColor}` }} />
              <span className="text-[10px] text-white/40">100% Adherent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: config.color + '18' }} />
              <span className="text-[10px] text-white/40">Gap</span>
            </div>
          </div>

          {/* Compliance badge */}
          <div className="flex items-center gap-2">
            <div className="text-[10px] text-white/30">14d Compliance</div>
            <div
              className="px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums"
              style={{
                background: avgCompliance >= 80 ? 'rgba(74,222,128,0.15)' : avgCompliance >= 50 ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)',
                color: avgCompliance >= 80 ? '#4ade80' : avgCompliance >= 50 ? '#fbbf24' : '#f87171',
              }}
            >
              {avgCompliance}%
            </div>
          </div>
        </div>

        {/* Insight text */}
        {projection && projection.gapPercent > 3 && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
            <p className="text-[11px] text-white/50 leading-relaxed">
              <span className="text-white/70 font-medium">Projection:</span>{' '}
              {config.higherIsBetter ? (
                <>
                  At current {avgCompliance}% adherence, your {config.label} will reach{' '}
                  <span className="text-white/70 font-medium tabular-nums">
                    {projection.current[projection.current.length - 1] < 10
                      ? projection.current[projection.current.length - 1].toFixed(1)
                      : Math.round(projection.current[projection.current.length - 1])} {config.unit}
                  </span>{' '}
                  in 14 days. Full compliance would push it to{' '}
                  <span className="font-medium tabular-nums" style={{ color: config.color }}>
                    {projection.optimized[projection.optimized.length - 1] < 10
                      ? projection.optimized[projection.optimized.length - 1].toFixed(1)
                      : Math.round(projection.optimized[projection.optimized.length - 1])} {config.unit}
                  </span>.
                  {' '}That{`'`}s a {projection.gapPercent}% gap you{`'`}re leaving on the table.
                </>
              ) : (
                <>
                  At current {avgCompliance}% adherence, your {config.label} will sit at{' '}
                  <span className="text-white/70 font-medium tabular-nums">
                    {projection.current[projection.current.length - 1] < 10
                      ? projection.current[projection.current.length - 1].toFixed(1)
                      : Math.round(projection.current[projection.current.length - 1])} {config.unit}
                  </span>{' '}
                  in 14 days. Full compliance could bring it down to{' '}
                  <span className="font-medium tabular-nums" style={{ color: config.color }}>
                    {projection.optimized[projection.optimized.length - 1] < 10
                      ? projection.optimized[projection.optimized.length - 1].toFixed(1)
                      : Math.round(projection.optimized[projection.optimized.length - 1])} {config.unit}
                  </span>.
                  {' '}Every missed protocol widens that gap.
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
