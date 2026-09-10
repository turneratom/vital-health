import { useState, useMemo, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';

/* ═══════════════════════════════════════════════════════════════
   Biomarker Reference Ranges — Age & Sex Aware
   ═══════════════════════════════════════════════════════════════ */

interface BiomarkerMeta {
  key: string;
  label: string;
  unit: string;
  icon: string;
  category: 'blood' | 'hormone' | 'metabolic' | 'cardiac' | 'performance';
  getRange: (age: number | null, gender: string | null) => {
    optimalLow: number;
    optimalHigh: number;
    warningLow: number;
    warningHigh: number;
    criticalLow: number;
    criticalHigh: number;
  };
}

const BIOMARKERS: BiomarkerMeta[] = [
  {
    key: 'vitaminD',
    label: 'Vitamin D',
    unit: 'ng/mL',
    icon: '☀️',
    category: 'blood',
    getRange: (age) => ({
      optimalLow: 40,
      optimalHigh: 60,
      warningLow: 30,
      warningHigh: 80,
      criticalLow: 20,
      criticalHigh: 100,
    }),
  },
  {
    key: 'testosteroneTotal',
    label: 'Testosterone (Total)',
    unit: 'ng/dL',
    icon: '⚡',
    category: 'hormone',
    getRange: (age, gender) => {
      if (gender === 'female') {
        return {
          optimalLow: 15,
          optimalHigh: 70,
          warningLow: 8,
          warningHigh: 100,
          criticalLow: 3,
          criticalHigh: 150,
        };
      }
      const ageFactor = age && age > 40 ? Math.max(0, (age - 40) * 5) : 0;
      return {
        optimalLow: 500 - ageFactor,
        optimalHigh: 900,
        warningLow: 300 - ageFactor,
        warningHigh: 1100,
        criticalLow: 200,
        criticalHigh: 1500,
      };
    },
  },
  {
    key: 'testosteroneFree',
    label: 'Testosterone (Free)',
    unit: 'pg/mL',
    icon: '🔥',
    category: 'hormone',
    getRange: (age, gender) => {
      if (gender === 'female') {
        return {
          optimalLow: 0.5,
          optimalHigh: 5,
          warningLow: 0.2,
          warningHigh: 8,
          criticalLow: 0.1,
          criticalHigh: 12,
        };
      }
      return {
        optimalLow: age && age > 50 ? 6 : 9,
        optimalHigh: 25,
        warningLow: 5,
        warningHigh: 30,
        criticalLow: 3,
        criticalHigh: 40,
      };
    },
  },
  {
    key: 'ferritin',
    label: 'Ferritin',
    unit: 'ng/mL',
    icon: '🩸',
    category: 'blood',
    getRange: (_age, gender) => ({
      optimalLow: gender === 'female' ? 40 : 50,
      optimalHigh: gender === 'female' ? 150 : 200,
      warningLow: gender === 'female' ? 20 : 30,
      warningHigh: 300,
      criticalLow: 10,
      criticalHigh: 500,
    }),
  },
  {
    key: 'crp',
    label: 'hs-CRP',
    unit: 'mg/L',
    icon: '🛡️',
    category: 'cardiac',
    getRange: () => ({
      optimalLow: 0,
      optimalHigh: 1.0,
      warningLow: 0,
      warningHigh: 3.0,
      criticalLow: 0,
      criticalHigh: 10.0,
    }),
  },
  {
    key: 'hba1c',
    label: 'HbA1c',
    unit: '%',
    icon: '🧬',
    category: 'metabolic',
    getRange: () => ({
      optimalLow: 4.0,
      optimalHigh: 5.4,
      warningLow: 3.5,
      warningHigh: 5.7,
      criticalLow: 3.0,
      criticalHigh: 6.5,
    }),
  },
];

/* ═══════════════════════════════════════════════════════════════
   Simulated Historical Data (when no real data exists)
   ═══════════════════════════════════════════════════════════════ */

function generateSimulatedHistory(
  marker: BiomarkerMeta,
  currentValue: number | null,
  age: number | null,
  gender: string | null
) {
  const range = marker.getRange(age, gender);
  const mid = (range.optimalLow + range.optimalHigh) / 2;
  const base = currentValue ?? mid;
  const spread = (range.optimalHigh - range.optimalLow) * 0.6;
  const points: { timestamp: number; value: number; source: string }[] = [];
  const now = Date.now();

  for (let i = 11; i >= 0; i--) {
    const t = now - i * 7 * 24 * 60 * 60 * 1000;
    const drift = (Math.random() - 0.45) * spread;
    const trend = ((11 - i) / 11) * (base - (base - spread * 0.3));
    let val = base - spread * 0.4 + drift + trend * 0.15;
    val = Math.max(range.criticalLow, Math.min(range.criticalHigh, val));
    points.push({ timestamp: t, value: Math.round(val * 10) / 10, source: 'simulated' });
  }

  if (currentValue != null) {
    points[points.length - 1] = { timestamp: now, value: currentValue, source: 'vault' };
  }

  return points;
}

/* ═══════════════════════════════════════════════════════════════
   Custom Tooltip
   ═══════════════════════════════════════════════════════════════ */

function CustomTooltip({ active, payload, label, unit, range }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  const date = new Date(label);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  let status = 'Optimal';
  let statusColor = '#00FFC6';
  if (val < range.optimalLow || val > range.optimalHigh) {
    if (val < range.warningLow || val > range.warningHigh) {
      status = 'Critical';
      statusColor = '#FF4444';
    } else {
      status = 'Warning';
      statusColor = '#FFB800';
    }
  }

  return (
    <div
      style={{
        background: 'rgba(10,10,10,0.95)',
        border: '1px solid rgba(0,255,198,0.15)',
        borderRadius: 12,
        padding: '12px 16px',
        backdropFilter: 'blur(20px)',
      }}
    >
      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 }}>{dateStr}</p>
      <p style={{ color: '#fff', fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {val} <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{unit}</span>
      </p>
      <p style={{ color: statusColor, fontSize: 11, fontWeight: 600, marginTop: 2 }}>● {status}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Custom Active Dot
   ═══════════════════════════════════════════════════════════════ */

function ActiveDot(props: any) {
  const { cx, cy } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="rgba(0,255,198,0.15)" />
      <circle cx={cx} cy={cy} r={5} fill="#0a0a0a" stroke="#00FFC6" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={2} fill="#00FFC6" />
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Zone Legend
   ═══════════════════════════════════════════════════════════════ */

function ZoneLegend({ range, unit }: { range: ReturnType<BiomarkerMeta['getRange']>; unit: string }) {
  return (
    <div className="flex flex-wrap gap-3 mt-3">
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#00FFC6' }} />
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
          Optimal {range.optimalLow}–{range.optimalHigh} {unit}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FFB800' }} />
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
          Warning &lt;{range.warningLow} or &gt;{range.warningHigh} {unit}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF4444' }} />
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
          Critical &lt;{range.criticalLow} or &gt;{range.criticalHigh} {unit}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Status Badge
   ═══════════════════════════════════════════════════════════════ */

function StatusBadge({ value, range }: { value: number | null; range: ReturnType<BiomarkerMeta['getRange']> }) {
  if (value == null) return null;

  let status = 'Optimal';
  let bg = 'rgba(0,255,198,0.1)';
  let color = '#00FFC6';
  let border = 'rgba(0,255,198,0.2)';

  if (value < range.optimalLow || value > range.optimalHigh) {
    if (value < range.warningLow || value > range.warningHigh) {
      status = 'Critical';
      bg = 'rgba(255,68,68,0.1)';
      color = '#FF4444';
      border = 'rgba(255,68,68,0.2)';
    } else {
      status = 'Attention';
      bg = 'rgba(255,184,0,0.1)';
      color = '#FFB800';
      border = 'rgba(255,184,0,0.2)';
    }
  }

  return (
    <span
      style={{
        background: bg,
        color,
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: '3px 10px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.03em',
      }}
    >
      {status}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Delta Indicator
   ═══════════════════════════════════════════════════════════════ */

function DeltaIndicator({ dataPoints, marker }: { dataPoints: any[]; marker: BiomarkerMeta }) {
  if (dataPoints.length < 2) return null;

  const latest = dataPoints[dataPoints.length - 1].value;
  const previous = dataPoints[dataPoints.length - 2].value;
  const delta = latest - previous;
  const pct = previous !== 0 ? Math.round((delta / previous) * 100) : 0;

  // For CRP, lower is better
  const isInverse = marker.key === 'crp' || marker.key === 'hba1c';
  const isPositive = isInverse ? delta < 0 : delta > 0;

  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color: isPositive ? '#00FFC6' : '#FF6B6B', fontSize: 13, fontWeight: 600 }}>
        {delta > 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}
      </span>
      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
        ({pct > 0 ? '+' : ''}{pct}%)
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Main TrendAnalytics Component
   ═══════════════════════════════════════════════════════════════ */

interface TrendAnalyticsProps {
  sessionId: string;
  initialMarker?: string;
  compact?: boolean;
}

export default function TrendAnalytics({ sessionId, initialMarker, compact = false }: TrendAnalyticsProps) {
  const [selectedMarker, setSelectedMarker] = useState(initialMarker ?? 'vitaminD');
  const [timeRange, setTimeRange] = useState<number>(90);

  const marker = BIOMARKERS.find((b) => b.key === selectedMarker) ?? BIOMARKERS[0];

  // Query real biomarker history from Convex
  const historyData = useQuery(api.queries.getBiomarkerHistory, {
    sessionId,
    marker: selectedMarker,
    days: timeRange,
  });

  const age = historyData?.age ?? null;
  const gender = historyData?.gender ?? null;
  const range = marker.getRange(age, gender);

  // Build chart data — use real data or simulated fallback
  const chartData = useMemo(() => {
    const realPoints = historyData?.dataPoints ?? [];
    const points =
      realPoints.length >= 2
        ? realPoints
        : generateSimulatedHistory(marker, historyData?.currentValue ?? null, age, gender);

    return points.map((p) => ({
      timestamp: p.timestamp,
      value: p.value,
      date: new Date(p.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      source: p.source,
    }));
  }, [historyData, marker, age, gender]);

  const isSimulated = (historyData?.dataPoints?.length ?? 0) < 2;
  const currentValue = historyData?.currentValue ?? (chartData.length > 0 ? chartData[chartData.length - 1].value : null);

  // Y-axis domain with padding
  const yDomain = useMemo(() => {
    const values = chartData.map((d) => d.value);
    const allValues = [...values, range.optimalLow, range.optimalHigh, range.warningLow, range.warningHigh];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const padding = (max - min) * 0.15;
    return [Math.max(0, Math.floor(min - padding)), Math.ceil(max + padding)];
  }, [chartData, range]);

  const handleMarkerSelect = useCallback((key: string) => {
    setSelectedMarker(key);
  }, []);

  const categoryColors: Record<string, string> = {
    blood: '#FF6B6B',
    hormone: '#FFB800',
    metabolic: '#00FFC6',
    cardiac: '#6B8AFF',
    performance: '#C084FC',
  };

  return (
    <div className="w-full">
      {/* ── Marker Selector ── */}
      {!compact && (
        <div className="mb-5">
          <p
            style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.15em', marginBottom: 8 }}
            className="uppercase font-semibold"
          >
            Select Biomarker
          </p>
          <div className="flex flex-wrap gap-2">
            {BIOMARKERS.map((b) => {
              const isActive = b.key === selectedMarker;
              return (
                <button
                  key={b.key}
                  onClick={() => handleMarkerSelect(b.key)}
                  className="transition-all duration-200"
                  style={{
                    background: isActive ? 'rgba(0,255,198,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? 'rgba(0,255,198,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 10,
                    padding: '8px 14px',
                    color: isActive ? '#00FFC6' : 'rgba(255,255,255,0.5)',
                    fontSize: 12,
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{b.icon}</span>
                  <span>{b.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Header: Current Value + Status ── */}
      <div
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
          padding: compact ? '16px' : '20px 24px',
          marginBottom: 16,
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span style={{ fontSize: 18 }}>{marker.icon}</span>
              <h3 style={{ color: '#fff', fontSize: compact ? 15 : 17, fontWeight: 700 }}>{marker.label}</h3>
              <StatusBadge value={currentValue} range={range} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
              {marker.category.charAt(0).toUpperCase() + marker.category.slice(1)} Panel · {marker.unit}
              {age ? ` · Age ${age}` : ''}
              {gender ? ` · ${gender.charAt(0).toUpperCase() + gender.slice(1)}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p style={{ color: '#fff', fontSize: compact ? 26 : 32, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {currentValue != null ? currentValue : '—'}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>{marker.unit}</p>
            {chartData.length >= 2 && <DeltaIndicator dataPoints={chartData} marker={marker} />}
          </div>
        </div>

        {/* ── Time Range Selector ── */}
        <div className="flex gap-1 mb-4">
          {[
            { label: '30d', value: 30 },
            { label: '90d', value: 90 },
            { label: '6mo', value: 180 },
            { label: '1yr', value: 365 },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setTimeRange(t.value)}
              style={{
                background: timeRange === t.value ? 'rgba(0,255,198,0.12)' : 'transparent',
                border: `1px solid ${timeRange === t.value ? 'rgba(0,255,198,0.25)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 6,
                padding: '4px 12px',
                color: timeRange === t.value ? '#00FFC6' : 'rgba(255,255,255,0.4)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Chart ── */}
        <div style={{ width: '100%', height: compact ? 200 : 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#00FFC6" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#00FFC6" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00FFC6" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#00FFC6" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.04)"
                vertical={false}
              />

              {/* Optimal Zone */}
              <ReferenceArea
                y1={range.optimalLow}
                y2={range.optimalHigh}
                fill="#00FFC6"
                fillOpacity={0.04}
                stroke="none"
              />

              {/* Warning Zone - Low */}
              {range.warningLow > 0 && (
                <ReferenceArea
                  y1={range.criticalLow}
                  y2={range.warningLow}
                  fill="#FFB800"
                  fillOpacity={0.03}
                  stroke="none"
                />
              )}

              {/* Warning Zone - High */}
              <ReferenceArea
                y1={range.warningHigh}
                y2={range.criticalHigh}
                fill="#FFB800"
                fillOpacity={0.03}
                stroke="none"
              />

              {/* Optimal boundary lines */}
              <ReferenceLine
                y={range.optimalLow}
                stroke="#00FFC6"
                strokeDasharray="4 4"
                strokeOpacity={0.25}
              />
              <ReferenceLine
                y={range.optimalHigh}
                stroke="#00FFC6"
                strokeDasharray="4 4"
                strokeOpacity={0.25}
              />

              {/* Warning boundary lines */}
              <ReferenceLine
                y={range.warningHigh}
                stroke="#FFB800"
                strokeDasharray="3 3"
                strokeOpacity={0.2}
              />
              {range.warningLow > 0 && (
                <ReferenceLine
                  y={range.warningLow}
                  stroke="#FFB800"
                  strokeDasharray="3 3"
                  strokeOpacity={0.2}
                />
              )}

              <XAxis
                dataKey="timestamp"
                tickFormatter={(ts: number) =>
                  new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={45}
              />

              <Tooltip
                content={<CustomTooltip unit={marker.unit} range={range} />}
                cursor={{ stroke: 'rgba(0,255,198,0.15)', strokeWidth: 1 }}
              />

              {/* Area fill under line */}
              <Area
                type="monotone"
                dataKey="value"
                fill="url(#areaGradient)"
                stroke="none"
              />

              {/* Main trend line */}
              <Line
                type="monotone"
                dataKey="value"
                stroke="url(#lineGradient)"
                strokeWidth={2.5}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const isVault = payload?.source === 'vault';
                  return (
                    <circle
                      key={`dot-${props.index}`}
                      cx={cx}
                      cy={cy}
                      r={isVault ? 4 : 2.5}
                      fill={isVault ? '#00FFC6' : 'rgba(0,255,198,0.5)'}
                      stroke={isVault ? '#0a0a0a' : 'none'}
                      strokeWidth={isVault ? 2 : 0}
                    />
                  );
                }}
                activeDot={<ActiveDot />}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* ── Zone Legend ── */}
        <ZoneLegend range={range} unit={marker.unit} />

        {/* ── Simulated Data Notice ── */}
        {isSimulated && (
          <div
            className="mt-3 flex items-center gap-2"
            style={{
              background: 'rgba(255,184,0,0.06)',
              border: '1px solid rgba(255,184,0,0.12)',
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            <span style={{ fontSize: 12 }}>📊</span>
            <span style={{ color: 'rgba(255,184,0,0.7)', fontSize: 11 }}>
              Showing projected trend. Upload lab results to see your real data.
            </span>
          </div>
        )}
      </div>

      {/* ── Insight Cards ── */}
      {!compact && currentValue != null && (
        <div className="grid grid-cols-2 gap-3">
          {/* Range Position Card */}
          <div
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.1em', marginBottom: 8 }} className="uppercase font-semibold">
              Range Position
            </p>
            <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {/* Optimal zone highlight */}
              <div
                className="absolute h-full rounded-full"
                style={{
                  left: `${((range.optimalLow - yDomain[0]) / (yDomain[1] - yDomain[0])) * 100}%`,
                  width: `${((range.optimalHigh - range.optimalLow) / (yDomain[1] - yDomain[0])) * 100}%`,
                  background: 'rgba(0,255,198,0.15)',
                }}
              />
              {/* Current value marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                style={{
                  left: `${Math.max(0, Math.min(100, ((currentValue - yDomain[0]) / (yDomain[1] - yDomain[0])) * 100))}%`,
                  transform: 'translate(-50%, -50%)',
                  background: currentValue >= range.optimalLow && currentValue <= range.optimalHigh ? '#00FFC6' : '#FFB800',
                  boxShadow: `0 0 8px ${currentValue >= range.optimalLow && currentValue <= range.optimalHigh ? 'rgba(0,255,198,0.4)' : 'rgba(255,184,0,0.4)'}`,
                }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>{yDomain[0]}</span>
              <span style={{ color: 'rgba(0,255,198,0.5)', fontSize: 10 }}>Optimal</span>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>{yDomain[1]}</span>
            </div>
          </div>

          {/* Data Points Card */}
          <div
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: 16,
            }}
          >
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, letterSpacing: '0.1em', marginBottom: 8 }} className="uppercase font-semibold">
              Tracking Summary
            </p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Data Points</span>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{chartData.length}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Time Span</span>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>{timeRange}d</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Last Updated</span>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
                  {historyData?.vaultUpdatedAt
                    ? new Date(historyData.vaultUpdatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : 'Today'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Quick-Switch (compact mode) ── */}
      {compact && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {BIOMARKERS.slice(0, 4).map((b) => (
            <button
              key={b.key}
              onClick={() => handleMarkerSelect(b.key)}
              style={{
                background: b.key === selectedMarker ? `${categoryColors[b.category]}15` : 'transparent',
                border: `1px solid ${b.key === selectedMarker ? `${categoryColors[b.category]}30` : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 8,
                padding: '4px 10px',
                color: b.key === selectedMarker ? categoryColors[b.category] : 'rgba(255,255,255,0.35)',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s',
              }}
            >
              {b.icon} {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Exported Biomarker List (for external use)
   ═══════════════════════════════════════════════════════════════ */
export { BIOMARKERS };
export type { BiomarkerMeta };
