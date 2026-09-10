import { useRef, useState } from 'react';

export interface HelixMarker {
  id: string;
  label: string;
  shortLabel: string;
  position: number; // 0-1 along the helix
  status: 'optimal' | 'variant' | 'risk' | 'unknown';
  icon: string;
  detail: string;
}

const STATUS_COLORS: Record<string, { fill: string; glow: string; text: string }> = {
  optimal: { fill: '#00FFCC', glow: 'rgba(0,255,204,0.5)', text: '#00FFCC' },
  variant: { fill: '#FFB86B', glow: 'rgba(255,184,107,0.5)', text: '#FFB86B' },
  risk: { fill: '#FF6B6B', glow: 'rgba(255,107,107,0.5)', text: '#FF6B6B' },
  unknown: { fill: 'rgba(255,255,255,0.2)', glow: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.3)' },
};

const GHOST_COLOR = { fill: 'rgba(160,160,160,0.3)', glow: 'rgba(160,160,160,0.15)', text: 'rgba(160,160,160,0.5)' };

/* ── Performance-based helix color presets ── */
const HELIX_THEMES = {
  younger: {
    strandA: 'rgba(0,255,204,0.3)',
    strandB: 'rgba(0,200,180,0.2)',
    rung: 'rgba(0,255,204,0.08)',
    gradA: { start: 'rgba(0,255,204,0.1)', mid: 'rgba(0,255,204,0.3)', end: 'rgba(0,255,204,0.1)' },
    gradB: { start: 'rgba(0,200,180,0.06)', mid: 'rgba(0,200,180,0.2)', end: 'rgba(0,200,180,0.06)' },
    bgGlow: 'rgba(0,255,204,',
    pulseSpeed: 3,
  },
  aligned: {
    strandA: 'rgba(196,164,108,0.25)',
    strandB: 'rgba(196,164,108,0.15)',
    rung: 'rgba(196,164,108,0.06)',
    gradA: { start: 'rgba(196,164,108,0.08)', mid: 'rgba(196,164,108,0.25)', end: 'rgba(196,164,108,0.08)' },
    gradB: { start: 'rgba(196,164,108,0.04)', mid: 'rgba(196,164,108,0.15)', end: 'rgba(196,164,108,0.04)' },
    bgGlow: 'rgba(196,164,108,',
    pulseSpeed: 5,
  },
  older: {
    strandA: 'rgba(212,132,122,0.28)',
    strandB: 'rgba(212,132,122,0.18)',
    rung: 'rgba(212,132,122,0.07)',
    gradA: { start: 'rgba(212,132,122,0.08)', mid: 'rgba(212,132,122,0.28)', end: 'rgba(212,132,122,0.08)' },
    gradB: { start: 'rgba(212,132,122,0.04)', mid: 'rgba(212,132,122,0.18)', end: 'rgba(212,132,122,0.04)' },
    bgGlow: 'rgba(212,132,122,',
    pulseSpeed: 3.5,
  },
} as const;

const GHOST_THEME = {
  strandA: 'rgba(160,160,160,0.15)',
  strandB: 'rgba(160,160,160,0.1)',
  rung: 'rgba(160,160,160,0.05)',
  gradA: { start: 'rgba(160,160,160,0.05)', mid: 'rgba(160,160,160,0.15)', end: 'rgba(160,160,160,0.05)' },
  gradB: { start: 'rgba(160,160,160,0.03)', mid: 'rgba(160,160,160,0.1)', end: 'rgba(160,160,160,0.03)' },
  bgGlow: 'rgba(160,160,160,',
  pulseSpeed: 6,
};

function generateHelixPoints(height: number, width: number, turns: number = 4, pointsPerTurn: number = 40) {
  const totalPoints = turns * pointsPerTurn;
  const amplitude = width * 0.28;
  const centerX = width / 2;
  const strandA: { x: number; y: number }[] = [];
  const strandB: { x: number; y: number }[] = [];
  const rungs: { ax: number; ay: number; bx: number; by: number; t: number }[] = [];

  for (let i = 0; i <= totalPoints; i++) {
    const t = i / totalPoints;
    const y = t * height;
    const angle = t * turns * Math.PI * 2;
    const xA = centerX + Math.sin(angle) * amplitude;
    const xB = centerX + Math.sin(angle + Math.PI) * amplitude;
    strandA.push({ x: xA, y });
    strandB.push({ x: xB, y });

    if (i % 8 === 0 && i > 0 && i < totalPoints) {
      rungs.push({ ax: xA, ay: y, bx: xB, by: y, t });
    }
  }

  return { strandA, strandB, rungs };
}

function pointsToPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx1 = prev.x + (curr.x - prev.x) * 0.5;
    const cpy1 = prev.y;
    const cpx2 = prev.x + (curr.x - prev.x) * 0.5;
    const cpy2 = curr.y;
    d += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${curr.x} ${curr.y}`;
  }
  return d;
}

export function HelixGraphic({
  markers,
  ghostMode,
  glowColor,
  onMarkerTap,
}: {
  markers: HelixMarker[];
  ghostMode: boolean;
  /** Performance direction from calculateBiologicalAgeOffset — drives helix color theme */
  glowColor?: 'younger' | 'older' | 'aligned';
  onMarkerTap?: (marker: HelixMarker) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeMarker, setActiveMarker] = useState<string | null>(null);

  const svgWidth = 320;
  const svgHeight = 600;
  const { strandA, strandB, rungs } = generateHelixPoints(svgHeight, svgWidth, 5, 48);

  const pathA = pointsToPath(strandA);
  const pathB = pointsToPath(strandB);

  /* ── Select helix color theme based on performance direction ── */
  const theme = ghostMode
    ? GHOST_THEME
    : HELIX_THEMES[glowColor ?? 'younger'];

  // Map markers to positions on the helix
  const markerPositions = markers.map((m) => {
    const yPos = m.position * svgHeight;
    const angle = m.position * 5 * Math.PI * 2;
    const amplitude = svgWidth * 0.28;
    const centerX = svgWidth / 2;
    const xA = centerX + Math.sin(angle) * amplitude;
    const xB = centerX + Math.sin(angle + Math.PI) * amplitude;
    const useStrandA = xA > xB;
    const x = useStrandA ? xA : xB;
    const labelSide: 'left' | 'right' = x > centerX ? 'right' : 'left';
    return { ...m, x, y: yPos, labelSide };
  });

  /* ── Unique filter/gradient IDs to avoid collisions ── */
  const uid = glowColor ?? 'default';

  /* ── Pulse animation keyframes ── */
  const pulseKeyframes = `
    @keyframes helix-bg-pulse-${uid} {
      0%, 100% { opacity: 0.15; }
      50% { opacity: 0.35; }
    }
    @keyframes helix-strand-pulse-${uid} {
      0%, 100% { stroke-opacity: 0.7; }
      50% { stroke-opacity: 1; }
    }
    @keyframes helix-rung-pulse-${uid} {
      0%, 100% { stroke-opacity: 0.5; }
      50% { stroke-opacity: 0.9; }
    }
  `;

  return (
    <div className="relative w-full flex justify-center">
      <style>{pulseKeyframes}</style>

      {/* ── Background glow aura — pulses with performance direction ── */}
      {!ghostMode && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center 40%, ${theme.bgGlow}0.12) 0%, ${theme.bgGlow}0.03) 40%, transparent 70%)`,
            animation: `helix-bg-pulse-${uid} ${theme.pulseSpeed}s ease-in-out infinite`,
            borderRadius: '50%',
            filter: 'blur(20px)',
          }}
        />
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        height="auto"
        style={{ maxWidth: 320, maxHeight: 600 }}
        className="overflow-visible"
      >
        <defs>
          <filter id={`helix-glow-${uid}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`marker-glow-${uid}`}>
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={`strand-a-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.gradA.start} />
            <stop offset="50%" stopColor={theme.gradA.mid} />
            <stop offset="100%" stopColor={theme.gradA.end} />
          </linearGradient>
          <linearGradient id={`strand-b-grad-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.gradB.start} />
            <stop offset="50%" stopColor={theme.gradB.mid} />
            <stop offset="100%" stopColor={theme.gradB.end} />
          </linearGradient>
        </defs>

        {/* Rungs (base pairs) — pulse with performance color */}
        {rungs.map((r, i) => (
          <line
            key={`rung-${i}`}
            x1={r.ax}
            y1={r.ay}
            x2={r.bx}
            y2={r.by}
            stroke={theme.rung}
            strokeWidth={1.5}
            strokeLinecap="round"
            style={
              !ghostMode
                ? {
                    animation: `helix-rung-pulse-${uid} ${theme.pulseSpeed}s ease-in-out infinite`,
                    animationDelay: `${(i * 0.15) % theme.pulseSpeed}s`,
                  }
                : undefined
            }
          />
        ))}

        {/* Strand B (back) — performance-tinted */}
        <path
          d={pathB}
          fill="none"
          stroke={`url(#strand-b-grad-${uid})`}
          strokeWidth={2}
          strokeLinecap="round"
          style={
            !ghostMode
              ? { animation: `helix-strand-pulse-${uid} ${theme.pulseSpeed}s ease-in-out infinite` }
              : undefined
          }
        />

        {/* Strand A (front) — performance-tinted with glow */}
        <path
          d={pathA}
          fill="none"
          stroke={`url(#strand-a-grad-${uid})`}
          strokeWidth={2.5}
          strokeLinecap="round"
          filter={ghostMode ? undefined : `url(#helix-glow-${uid})`}
          style={
            !ghostMode
              ? {
                  animation: `helix-strand-pulse-${uid} ${theme.pulseSpeed}s ease-in-out infinite`,
                  animationDelay: `${theme.pulseSpeed * 0.25}s`,
                }
              : undefined
          }
        />

        {/* Marker nodes */}
        {markerPositions.map((mp) => {
          const colors = ghostMode ? GHOST_COLOR : STATUS_COLORS[mp.status];
          const isActive = activeMarker === mp.id;
          const labelX = mp.labelSide === 'right' ? mp.x + 22 : mp.x - 22;

          return (
            <g
              key={mp.id}
              className="cursor-pointer"
              onClick={() => {
                setActiveMarker(isActive ? null : mp.id);
                if (onMarkerTap) onMarkerTap(mp);
              }}
            >
              {/* Pulse ring */}
              {mp.status !== 'unknown' && !ghostMode && (
                <circle
                  cx={mp.x}
                  cy={mp.y}
                  r={isActive ? 14 : 10}
                  fill="none"
                  stroke={colors.fill}
                  strokeWidth={0.5}
                  opacity={0.3}
                >
                  <animate
                    attributeName="r"
                    values={isActive ? '14;20;14' : '10;16;10'}
                    dur="2.5s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.3;0;0.3"
                    dur="2.5s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Marker dot */}
              <circle
                cx={mp.x}
                cy={mp.y}
                r={isActive ? 7 : 5}
                fill={colors.fill}
                filter={ghostMode ? undefined : `url(#marker-glow-${uid})`}
                style={{ transition: 'r 0.2s ease' }}
              />

              {/* Inner dot */}
              <circle
                cx={mp.x}
                cy={mp.y}
                r={2}
                fill={ghostMode ? 'rgba(30,30,30,0.8)' : 'rgba(5,5,5,0.8)'}
              />

              {/* Connection line to label */}
              <line
                x1={mp.x + (mp.labelSide === 'right' ? 8 : -8)}
                y1={mp.y}
                x2={labelX}
                y2={mp.y}
                stroke={colors.fill}
                strokeWidth={0.5}
                opacity={0.4}
                strokeDasharray="2 2"
              />

              {/* Label */}
              <text
                x={labelX + (mp.labelSide === 'right' ? 4 : -4)}
                y={mp.y - 5}
                fill={colors.text}
                fontSize={9}
                fontFamily="monospace"
                fontWeight={600}
                textAnchor={mp.labelSide === 'right' ? 'start' : 'end'}
              >
                {mp.shortLabel}
              </text>
              <text
                x={labelX + (mp.labelSide === 'right' ? 4 : -4)}
                y={mp.y + 7}
                fill={ghostMode ? 'rgba(160,160,160,0.25)' : 'rgba(255,255,255,0.3)'}
                fontSize={7}
                fontFamily="monospace"
                textAnchor={mp.labelSide === 'right' ? 'start' : 'end'}
              >
                {mp.detail}
              </text>

              {/* Status icon placeholder */}
              <text
                x={mp.x}
                y={mp.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={8}
                style={{ pointerEvents: 'none' }}
              >
                {mp.icon === '\u2713' ? '' : ''}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
