import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { getTwinSessionId } from '@/lib/twinSession';

/* ─── Palette ─── */
const C = {
  bg: 'rgba(26,24,22,0.85)',
  bgCard: 'rgba(32,30,28,0.9)',
  bgLight: 'rgba(26,24,22,0.4)',
  border: 'rgba(168,155,138,0.12)',
  borderActive: 'rgba(168,155,138,0.25)',
  text: 'rgba(245,240,235,0.92)',
  textMuted: 'rgba(200,190,178,0.6)',
  textFaint: 'rgba(200,190,178,0.35)',
  sage: '#7CB68E',
  sageBg: 'rgba(124,182,142,0.08)',
  sageBorder: 'rgba(124,182,142,0.2)',
  sky: '#6BA3BE',
  skyBg: 'rgba(107,163,190,0.08)',
  skyBorder: 'rgba(107,163,190,0.2)',
  gold: '#C4A46C',
  goldBg: 'rgba(196,164,108,0.08)',
  goldBorder: 'rgba(196,164,108,0.2)',
  rose: '#D4847A',
  roseBg: 'rgba(212,132,122,0.08)',
  roseBorder: 'rgba(212,132,122,0.2)',
  lavender: '#B08EC6',
  lavenderBg: 'rgba(176,142,198,0.08)',
  lavenderBorder: 'rgba(176,142,198,0.2)',
};

/* ─── Tier config ─── */
const TIER_CONFIG: Record<string, { color: string; bg: string; border: string; glow: string }> = {
  'Mission Ready': { color: C.sage, bg: C.sageBg, border: C.sageBorder, glow: 'rgba(124,182,142,0.3)' },
  'Operational': { color: C.sky, bg: C.skyBg, border: C.skyBorder, glow: 'rgba(107,163,190,0.3)' },
  'Recovering': { color: C.gold, bg: C.goldBg, border: C.goldBorder, glow: 'rgba(196,164,108,0.3)' },
  'Stand Down': { color: C.rose, bg: C.roseBg, border: C.roseBorder, glow: 'rgba(212,132,122,0.3)' },
};

/* ─── Mini Sparkline (SVG) ─── */
const Sparkline = React.memo(({ data, color, height = 32, width = 120 }: {
  data: number[]; color: string; height?: number; width?: number;
}) => {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg-${color.replace('#', '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Latest point dot */}
      {data.length > 0 && (() => {
        const lastX = width;
        const lastY = height - ((data[data.length - 1] - min) / range) * (height - 4) - 2;
        return <circle cx={lastX} cy={lastY} r="2.5" fill={color} />;
      })()}
    </svg>
  );
});
Sparkline.displayName = 'Sparkline';

/* ─── Radial Score Ring ─── */
const ScoreRing = React.memo(({ score, size = 160, tier, tierEmoji }: {
  score: number | null; size?: number; tier: string; tierEmoji: string;
}) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const tc = TIER_CONFIG[tier] || TIER_CONFIG['Recovering'];

  useEffect(() => {
    if (score === null) return;
    let frame: number;
    const start = performance.now();
    const duration = 1200;
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedScore(Math.round(eased * score));
      if (t < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const progress = score !== null ? (animatedScore / 100) * circumference : 0;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Glow */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${tc.glow} 0%, transparent 70%)`,
          filter: 'blur(20px)',
          opacity: score !== null ? 0.6 : 0,
          transition: 'opacity 1s ease',
        }}
      />
      <svg width={size} height={size} className="absolute">
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={C.border} strokeWidth="6"
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={tc.color} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.05s linear' }}
        />
      </svg>
      {/* Center text */}
      <div className="relative flex flex-col items-center">
        {score !== null ? (
          <>
            <span className="text-[36px] font-light font-serif" style={{ color: tc.color, lineHeight: 1 }}>
              {animatedScore}
            </span>
            <span className="text-[10px] font-semibold tracking-[0.15em] mt-1" style={{ color: C.textFaint }}>
              OUT OF 100
            </span>
          </>
        ) : (
          <>
            <span className="text-2xl">{tierEmoji}</span>
            <span className="text-[11px] mt-1" style={{ color: C.textFaint }}>No data</span>
          </>
        )}
      </div>
    </div>
  );
});
ScoreRing.displayName = 'ScoreRing';

/* ─── Component Score Bar ─── */
const ComponentBar = React.memo(({ label, score, weight, color }: {
  label: string; score: number | null; weight: number; color: string;
}) => (
  <div className="flex items-center gap-3">
    <div className="w-[110px] flex-shrink-0">
      <div className="text-[12px] font-semibold" style={{ color: C.text }}>{label}</div>
      <div className="text-[10px]" style={{ color: C.textFaint }}>{weight}% weight</div>
    </div>
    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: C.bgLight }}>
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{
          width: score !== null ? `${score}%` : '0%',
          background: `linear-gradient(90deg, ${color}88, ${color})`,
        }}
      />
    </div>
    <span className="w-10 text-right text-[13px] font-semibold font-serif" style={{ color: score !== null ? color : C.textFaint }}>
      {score !== null ? score : '—'}
    </span>
  </div>
));
ComponentBar.displayName = 'ComponentBar';

/* ─── Blood Marker Row ─── */
const MarkerRow = React.memo(({ label, value, unit, optimal, status }: {
  label: string; value: number | null; unit: string; optimal: string; status: 'optimal' | 'borderline' | 'attention';
}) => {
  const statusMap = {
    optimal: { color: C.sage, icon: '✅', label: 'Optimal' },
    borderline: { color: C.gold, icon: '👀', label: 'Watch' },
    attention: { color: C.rose, icon: '⚠️', label: 'Attention' },
  };
  const s = statusMap[status];
  return (
    <div className="flex items-center justify-between py-2.5" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div>
        <span className="text-[13px] font-medium" style={{ color: C.text }}>{label}</span>
        <span className="text-[11px] ml-2" style={{ color: C.textFaint }}>({optimal})</span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="text-[15px] font-serif font-semibold" style={{ color: value !== null ? s.color : C.textFaint }}>
          {value !== null ? value : '—'}
        </span>
        <span className="text-[11px]" style={{ color: C.textFaint }}>{unit}</span>
        <span className="text-xs">{s.icon}</span>
      </div>
    </div>
  );
});
MarkerRow.displayName = 'MarkerRow';

/* ═══════════════════════════════════════════════════════════════
   WeeklyDebrief — High-end Medical Report
   ═══════════════════════════════════════════════════════════════ */
const WeeklyDebrief: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(true);
  useEffect(() => { setMounted(true); }, []);

  const sessionId = typeof window !== 'undefined' ? getTwinSessionId() : '';
  const debrief = useQuery(api.bioVaultMetrics.getWeeklyDebrief, sessionId ? { sessionId } : 'skip');

  const tc = useMemo(() => {
    if (!debrief) return TIER_CONFIG['Recovering'];
    return TIER_CONFIG[debrief.tier] || TIER_CONFIG['Recovering'];
  }, [debrief]);

  const componentColors = [C.sky, C.lavender, C.rose, C.gold];

  const getMarkerStatus = (val: number | null, low: number, high: number, inverse = false): 'optimal' | 'borderline' | 'attention' => {
    if (val === null) return 'borderline';
    if (inverse) return val <= high ? 'optimal' : val <= high * 1.5 ? 'borderline' : 'attention';
    return val >= low && val <= high ? 'optimal' : val >= low * 0.8 ? 'borderline' : 'attention';
  };

  if (!mounted) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-500"
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
      }}
    >
      {/* ── Report Header ── */}
      <div
        className="px-5 py-4 cursor-pointer"
        style={{ borderBottom: `1px solid ${C.border}` }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: tc.bg, border: `1px solid ${tc.border}` }}
            >
              📊
            </div>
            <div>
              <h3 className="text-[16px] font-bold" style={{ color: C.text }}>Weekly Debrief</h3>
              <p className="text-[11px] mt-0.5" style={{ color: C.textFaint }}>
                {debrief ? `${debrief.periodStart} — ${debrief.periodEnd}` : 'Loading report...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {debrief?.readinessScore !== null && debrief?.readinessScore !== undefined && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: tc.bg, border: `1px solid ${tc.border}` }}
              >
                <span className="text-xs">{debrief?.tierEmoji}</span>
                <span className="text-[11px] font-bold" style={{ color: tc.color }}>{debrief?.tier}</span>
              </div>
            )}
            <span
              className="text-[18px] transition-transform duration-300"
              style={{ color: C.textFaint, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              ▾
            </span>
          </div>
        </div>
      </div>

      {/* ── Expanded Report Body ── */}
      {expanded && (
        <div
          className="px-5 py-5 space-y-6"
          style={{ animation: 'debriefFadeIn 0.4s ease both' }}
        >
          {/* ── Readiness Score Ring ── */}
          <div className="flex flex-col items-center">
            <div className="text-[10px] font-bold tracking-[0.2em] mb-4" style={{ color: C.textFaint }}>
              SQUAD READINESS SCORE
            </div>
            <ScoreRing
              score={debrief?.readinessScore ?? null}
              tier={debrief?.tier ?? 'Unknown'}
              tierEmoji={debrief?.tierEmoji ?? '❓'}
            />
            {debrief?.tier && debrief.tier !== 'Unknown' && (
              <div
                className="mt-4 px-4 py-2 rounded-xl text-center"
                style={{ background: tc.bg, border: `1px solid ${tc.border}` }}
              >
                <span className="text-[12px] font-semibold" style={{ color: tc.color }}>
                  {debrief.tier === 'Mission Ready' && 'Peak performance — you are cleared for all operations.'}
                  {debrief.tier === 'Operational' && 'Solid baseline — minor optimizations recommended.'}
                  {debrief.tier === 'Recovering' && 'Recovery in progress — prioritize rest and nutrition.'}
                  {debrief.tier === 'Stand Down' && 'Critical recovery needed — reduce intensity, focus on sleep.'}
                </span>
              </div>
            )}
          </div>

          {/* ── Component Breakdown ── */}
          <div>
            <div className="text-[11px] font-bold tracking-[0.15em] mb-3" style={{ color: C.textFaint }}>
              SCORE COMPONENTS
            </div>
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ background: C.bgLight, border: `1px solid ${C.border}` }}
            >
              {debrief?.components.map((comp, i) => (
                <ComponentBar
                  key={comp.label}
                  label={comp.label}
                  score={comp.score}
                  weight={comp.weight}
                  color={componentColors[i % componentColors.length]}
                />
              )) ?? (
                <div className="text-center py-4 text-[12px]" style={{ color: C.textFaint }}>
                  Collecting data...
                </div>
              )}
            </div>
          </div>

          {/* ── Sleep Analysis ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🌙</span>
              <span className="text-[11px] font-bold tracking-[0.15em]" style={{ color: C.textFaint }}>
                SLEEP ANALYSIS
              </span>
              {debrief?.sleep.count !== undefined && (
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: C.skyBg, border: `1px solid ${C.skyBorder}`, color: C.sky }}>
                  {debrief.sleep.count} nights
                </span>
              )}
            </div>
            <div
              className="rounded-xl p-4"
              style={{ background: C.bgLight, border: `1px solid ${C.border}` }}
            >
              {debrief && debrief.sleep.count > 0 ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[22px] font-light font-serif" style={{ color: C.sky }}>
                        {debrief.sleep.avgScore}
                      </div>
                      <div className="text-[10px]" style={{ color: C.textFaint }}>Avg Score</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[22px] font-light font-serif" style={{ color: C.sky }}>
                        {debrief.sleep.avgHours}h
                      </div>
                      <div className="text-[10px]" style={{ color: C.textFaint }}>Avg Duration</div>
                    </div>
                    <Sparkline data={debrief.sleep.nights.map(n => n.score)} color={C.sky} />
                  </div>
                  {/* Nightly breakdown */}
                  <div className="space-y-1.5 mt-3" style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                    {debrief.sleep.nights.slice(-7).map((night) => (
                      <div key={night.date} className="flex items-center justify-between">
                        <span className="text-[11px] font-mono" style={{ color: C.textFaint }}>{night.date}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px]" style={{ color: C.textMuted }}>{night.hours}h</span>
                          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: C.bgLight }}>
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${night.score}%`,
                                background: night.score >= 80 ? C.sage : night.score >= 60 ? C.gold : C.rose,
                              }}
                            />
                          </div>
                          <span className="text-[12px] font-semibold w-7 text-right" style={{
                            color: night.score >= 80 ? C.sage : night.score >= 60 ? C.gold : C.rose,
                          }}>
                            {night.score}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <span className="text-2xl">🌙</span>
                  <p className="text-[12px] mt-2" style={{ color: C.textFaint }}>No sleep data this week</p>
                </div>
              )}
            </div>
          </div>

          {/* ── HRV Recovery ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">💓</span>
              <span className="text-[11px] font-bold tracking-[0.15em]" style={{ color: C.textFaint }}>
                HRV RECOVERY
              </span>
              {debrief?.hrv.trend && (
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                  background: debrief.hrv.trend === 'up' ? C.sageBg : debrief.hrv.trend === 'down' ? C.roseBg : C.goldBg,
                  border: `1px solid ${debrief.hrv.trend === 'up' ? C.sageBorder : debrief.hrv.trend === 'down' ? C.roseBorder : C.goldBorder}`,
                  color: debrief.hrv.trend === 'up' ? C.sage : debrief.hrv.trend === 'down' ? C.rose : C.gold,
                }}>
                  {debrief.hrv.trend === 'up' ? '↑ Improving' : debrief.hrv.trend === 'down' ? '↓ Declining' : '→ Stable'}
                </span>
              )}
            </div>
            <div
              className="rounded-xl p-4"
              style={{ background: C.bgLight, border: `1px solid ${C.border}` }}
            >
              {debrief && debrief.hrv.count > 0 ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[28px] font-light font-serif" style={{ color: C.lavender }}>
                      {debrief.hrv.avg7d}
                    </div>
                    <div className="text-[10px]" style={{ color: C.textFaint }}>7-day avg (ms)</div>
                  </div>
                  <div className="text-right mr-4">
                    <div className="text-[14px] font-semibold" style={{ color: C.textMuted }}>
                      {debrief.hrv.count} readings
                    </div>
                  </div>
                  <Sparkline data={debrief.hrv.readings.map(r => r.value)} color={C.lavender} />
                </div>
              ) : (
                <div className="text-center py-4">
                  <span className="text-2xl">💓</span>
                  <p className="text-[12px] mt-2" style={{ color: C.textFaint }}>No HRV readings this week</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Blood Markers ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🩸</span>
              <span className="text-[11px] font-bold tracking-[0.15em]" style={{ color: C.textFaint }}>
                BLOOD MARKERS
              </span>
              {debrief?.blood.score !== null && (
                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{
                  background: (debrief?.blood.score ?? 0) >= 80 ? C.sageBg : (debrief?.blood.score ?? 0) >= 60 ? C.goldBg : C.roseBg,
                  border: `1px solid ${(debrief?.blood.score ?? 0) >= 80 ? C.sageBorder : (debrief?.blood.score ?? 0) >= 60 ? C.goldBorder : C.roseBorder}`,
                  color: (debrief?.blood.score ?? 0) >= 80 ? C.sage : (debrief?.blood.score ?? 0) >= 60 ? C.gold : C.rose,
                }}>
                  Score: {debrief?.blood.score}
                </span>
              )}
            </div>
            <div
              className="rounded-xl p-4"
              style={{ background: C.bgLight, border: `1px solid ${C.border}` }}
            >
              {debrief?.blood.markers ? (
                <div>
                  <MarkerRow label="Vitamin D" value={debrief.blood.markers.vitaminD} unit="ng/mL" optimal="40–60" status={getMarkerStatus(debrief.blood.markers.vitaminD, 40, 60)} />
                  <MarkerRow label="Testosterone" value={debrief.blood.markers.testosteroneTotal} unit="ng/dL" optimal="500–900" status={getMarkerStatus(debrief.blood.markers.testosteroneTotal, 500, 900)} />
                  <MarkerRow label="Ferritin" value={debrief.blood.markers.ferritin} unit="ng/mL" optimal="40–150" status={getMarkerStatus(debrief.blood.markers.ferritin, 40, 150)} />
                  <MarkerRow label="CRP" value={debrief.blood.markers.crp} unit="mg/L" optimal="<1.0" status={getMarkerStatus(debrief.blood.markers.crp, 0, 1, true)} />
                  <MarkerRow label="HbA1c" value={debrief.blood.markers.hba1c} unit="%" optimal="<5.7" status={getMarkerStatus(debrief.blood.markers.hba1c, 0, 5.7, true)} />
                  {debrief.blood.recentLabCount > 0 && (
                    <div className="mt-2 text-[10px]" style={{ color: C.textFaint }}>
                      +{debrief.blood.recentLabCount} lab result{debrief.blood.recentLabCount > 1 ? 's' : ''} uploaded this week
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <span className="text-2xl">🩸</span>
                  <p className="text-[12px] mt-2" style={{ color: C.textFaint }}>No blood work on file</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Mission Adherence ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🎯</span>
              <span className="text-[11px] font-bold tracking-[0.15em]" style={{ color: C.textFaint }}>
                MISSION ADHERENCE
              </span>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ background: C.bgLight, border: `1px solid ${C.border}` }}
            >
              {debrief && (debrief.missions.avgAdherence !== null || debrief.missions.totalProtocolsLogged > 0) ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[28px] font-light font-serif" style={{
                        color: (debrief.missions.avgAdherence ?? 0) >= 80 ? C.sage : (debrief.missions.avgAdherence ?? 0) >= 60 ? C.gold : C.rose,
                      }}>
                        {debrief.missions.avgAdherence !== null ? `${debrief.missions.avgAdherence}%` : '—'}
                      </div>
                      <div className="text-[10px]" style={{ color: C.textFaint }}>Avg Adherence</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[18px] font-serif" style={{ color: C.gold }}>
                        {debrief.missions.totalProtocolsLogged}
                      </div>
                      <div className="text-[10px]" style={{ color: C.textFaint }}>Protocols logged</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[18px] font-serif" style={{ color: C.sky }}>
                        {debrief.missions.daysTracked}
                      </div>
                      <div className="text-[10px]" style={{ color: C.textFaint }}>Days tracked</div>
                    </div>
                  </div>
                  {/* Daily protocol bar chart */}
                  {Object.keys(debrief.missions.protocolsByDay).length > 0 && (
                    <div className="flex items-end gap-1 h-10 mt-2" style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                      {(() => {
                        const days = Object.entries(debrief.missions.protocolsByDay).sort(([a], [b]) => a.localeCompare(b)).slice(-7);
                        const maxVal = Math.max(...days.map(([, v]) => v), 1);
                        return days.map(([date, count]) => (
                          <div key={date} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className="w-full rounded-sm transition-all duration-500"
                              style={{
                                height: `${(count / maxVal) * 28}px`,
                                minHeight: 3,
                                background: `linear-gradient(180deg, ${C.gold}, ${C.gold}88)`,
                              }}
                            />
                            <span className="text-[8px] font-mono" style={{ color: C.textFaint }}>
                              {date.slice(8)}
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <span className="text-2xl">🎯</span>
                  <p className="text-[12px] mt-2" style={{ color: C.textFaint }}>No mission data this week</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Report Footer ── */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: C.bgLight, border: `1px solid ${C.border}` }}
            >
              <span className="text-xs">🔒</span>
              <span className="text-[10px]" style={{ color: C.textFaint }}>
                Generated {debrief ? new Date(debrief.generatedAt).toLocaleString() : '...'} · Private & Encrypted
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes debriefFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default WeeklyDebrief;
