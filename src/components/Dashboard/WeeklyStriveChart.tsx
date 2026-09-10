import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/* ══════════════════════════════════════════════════════════════ */
/*  WeeklyStriveChart — Slim Sparkline Performance Trend         */
/* ══════════════════════════════════════════════════════════════ */

interface WeeklyStriveChartProps {
  scores: number[];
  currentScore?: number;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDayLabels(): string[] {
  const today = new Date().getDay();
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayIdx = (today - i + 7) % 7;
    labels.push(DAY_LABELS[dayIdx === 0 ? 6 : dayIdx - 1]);
  }
  return labels;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  const color = val >= 70 ? '#7CB68E' : val >= 45 ? '#C4A46C' : '#D4847A';
  return (
    <div
      style={{
        background: 'rgba(15,14,13,0.92)',
        border: '1px solid rgba(232,151,108,0.15)',
        borderRadius: 6,
        padding: '4px 8px',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ color: 'rgba(138,126,114,0.6)', fontSize: 8, fontFamily: 'monospace' }}>
        {label}
      </div>
      <div style={{ color, fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>
        {val}
      </div>
    </div>
  );
}

export const WeeklyStriveChart = React.memo(function WeeklyStriveChart({
  scores,
  currentScore,
}: WeeklyStriveChartProps) {
  const dayLabels = useMemo(() => getDayLabels(), []);

  const chartData = useMemo(() => {
    const s = scores.length >= 7 ? scores.slice(-7) : scores;
    return dayLabels.map((day, i) => ({
      day,
      score: s[i] ?? 0,
    }));
  }, [scores, dayLabels]);

  const avg = useMemo(() => {
    const valid = chartData.filter((d) => d.score > 0);
    if (valid.length === 0) return 0;
    return Math.round(valid.reduce((s, d) => s + d.score, 0) / valid.length);
  }, [chartData]);

  const trend = useMemo(() => {
    const valid = chartData.filter((d) => d.score > 0);
    if (valid.length < 2) return 0;
    return valid[valid.length - 1].score - valid[valid.length - 2].score;
  }, [chartData]);

  const trendColor = trend >= 0 ? '#7CB68E' : '#D4847A';
  const trendIcon = trend >= 0 ? '↑' : '↓';
  const displayScore = currentScore ?? avg;
  const scoreColor = displayScore >= 70 ? '#7CB68E' : displayScore >= 45 ? '#C4A46C' : '#D4847A';

  const gradientId = 'weeklyStriveGrad';

  return (
    <div>
      {/* Single-row header: title + 7-DAY AVG + TREND */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-mono tracking-wider uppercase"
            style={{ color: 'rgba(138,126,114,0.5)' }}
          >
            Weekly Strive
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="text-[9px] font-mono"
            style={{ color: 'rgba(138,126,114,0.45)' }}
          >
            7-DAY AVG:{' '}
            <span style={{ color: scoreColor, fontWeight: 600 }}>{avg}</span>
          </span>
          <span
            className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded"
            style={{
              color: trendColor,
              background: `${trendColor}12`,
              border: `1px solid ${trendColor}25`,
            }}
          >
            {trendIcon}{Math.abs(trend)}{' '}
            <span style={{ fontWeight: 400, opacity: 0.7 }}>
              {trend >= 0 ? 'UP' : 'DOWN'}
            </span>
          </span>
        </div>
      </div>

      {/* Sparkline chart — 70px tall */}
      <div style={{ width: '100%', height: 70 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 4, right: 2, left: 2, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={scoreColor} stopOpacity={0.2} />
                <stop offset="100%" stopColor={scoreColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`${gradientId}Stroke`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#C4A46C" />
                <stop offset="40%" stopColor="#7CB68E" />
                <stop offset="70%" stopColor="#7CB68E" />
                <stop offset="100%" stopColor="#C4A46C" />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: 'rgba(138,126,114,0.35)',
                fontSize: 8,
                fontFamily: 'monospace',
              }}
              dy={2}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{
                stroke: 'rgba(232,151,108,0.1)',
                strokeWidth: 1,
                strokeDasharray: '3 3',
              }}
            />

            <Area
              type="monotone"
              dataKey="score"
              stroke={`url(#${gradientId}Stroke)`}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={(props: any) => {
                const { cx, cy, payload, index } = props;
                const val = payload?.score ?? 0;
                const isLast = index === chartData.length - 1;
                const c = val >= 70 ? '#7CB68E' : val >= 45 ? '#C4A46C' : '#D4847A';
                if (val === 0) return <g key={index} />;
                return (
                  <g key={index}>
                    {isLast && (
                      <circle cx={cx} cy={cy} r={5} fill={c} opacity={0.1}>
                        <animate
                          attributeName="r"
                          values="5;8;5"
                          dur="2.5s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.1;0.03;0.1"
                          dur="2.5s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isLast ? 3 : 2}
                      fill={c}
                      stroke="rgba(15,14,13,0.6)"
                      strokeWidth={1}
                    />
                  </g>
                );
              }}
              activeDot={(props: any) => {
                const { cx, cy, payload } = props;
                const val = payload?.score ?? 0;
                const c = val >= 70 ? '#7CB68E' : val >= 45 ? '#C4A46C' : '#D4847A';
                return (
                  <g>
                    <circle cx={cx} cy={cy} r={6} fill={c} opacity={0.12} />
                    <circle cx={cx} cy={cy} r={3} fill={c} stroke="rgba(15,14,13,0.8)" strokeWidth={1} />
                  </g>
                );
              }}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

export default WeeklyStriveChart;
