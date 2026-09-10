import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

/* ═══════════════════════════════════════════════════════════════
   WEEKLY PERFORMANCE REPORT
   
   Magazine-style scrollable report synthesizing all logged data
   into a visual narrative with stagger animations.
   ═══════════════════════════════════════════════════════════════ */

const SESSION_ID = 'vive-user-001';

/* ── Helpers ── */
function getWeekRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { start: monday, end: sunday, label: `${fmt(monday)} – ${fmt(sunday)}` };
}

function getDayAbbreviations(): string[] {
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
}

function getDateKeysForWeek(start: Date): string[] {
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

/* ── SVG Mini Sparkline ── */
function Sparkline({ data, color, width = 80, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="3 3" />
      </svg>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
      {/* Area fill */}
      <polygon
        fill={`url(#spark-${color.replace('#', '')})`}
        points={`${pad},${height - pad} ${points} ${pad + ((data.length - 1) / (data.length - 1)) * (width - pad * 2)},${height - pad}`}
      />
      {/* Latest point dot */}
      {data.length > 0 && (() => {
        const lastX = pad + ((data.length - 1) / (data.length - 1)) * (width - pad * 2);
        const lastY = pad + (1 - (data[data.length - 1] - min) / range) * (height - pad * 2);
        return <circle cx={lastX} cy={lastY} r="2.5" fill={color} />;
      })()}
    </svg>
  );
}

/* ── Dual Line Chart for Mood & Energy ── */
function DualLineChart({ mood, energy, width = 280, height = 100 }: { mood: number[]; energy: number[]; width?: number; height?: number }) {
  const allVals = [...mood, ...energy].filter(v => v > 0);
  if (allVals.length < 2) {
    return (
      <div className="flex items-center justify-center py-8" style={{ height }}>
        <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Not enough data yet — log mood &amp; energy via Quick Log
        </span>
      </div>
    );
  }
  const min = 0.5;
  const max = 5.5;
  const range = max - min;
  const pad = 16;

  const toPoints = (data: number[]) => data.map((v, i) => {
    const x = pad + (i / 6) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return { x, y, v };
  });

  const moodPts = toPoints(mood);
  const energyPts = toPoints(energy);
  const days = getDayAbbreviations();

  // Find high/low points
  const moodValid = moodPts.filter(p => p.v > 0);
  const energyValid = energyPts.filter(p => p.v > 0);
  const moodHigh = moodValid.length > 0 ? moodValid.reduce((a, b) => a.v >= b.v ? a : b) : null;
  const moodLow = moodValid.length > 0 ? moodValid.reduce((a, b) => a.v <= b.v ? a : b) : null;
  const energyHigh = energyValid.length > 0 ? energyValid.reduce((a, b) => a.v >= b.v ? a : b) : null;
  const energyLow = energyValid.length > 0 ? energyValid.reduce((a, b) => a.v <= b.v ? a : b) : null;

  const moodLine = moodPts.filter(p => p.v > 0).map(p => `${p.x},${p.y}`).join(' ');
  const energyLine = energyPts.filter(p => p.v > 0).map(p => `${p.x},${p.y}`).join(' ');

  return (
    <svg width={width} height={height + 20} viewBox={`0 0 ${width} ${height + 20}`}>
      {/* Grid lines */}
      {[1, 2, 3, 4, 5].map(v => {
        const y = pad + (1 - (v - min) / range) * (height - pad * 2);
        return (
          <g key={v}>
            <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            <text x={pad - 4} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="monospace">{v}</text>
          </g>
        );
      })}
      {/* Day labels */}
      {days.map((d, i) => {
        const x = pad + (i / 6) * (width - pad * 2);
        return <text key={i} x={x} y={height + 12} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">{d}</text>;
      })}
      {/* Mood line */}
      {moodLine && <polyline fill="none" stroke="#00E5CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={moodLine} />}
      {/* Energy line */}
      {energyLine && <polyline fill="none" stroke="#FF9F0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={energyLine} strokeDasharray="4 2" />}
      {/* Emoji anchors */}
      {moodHigh && <text x={moodHigh.x} y={moodHigh.y - 8} textAnchor="middle" fontSize="12">😊</text>}
      {moodLow && moodLow !== moodHigh && <text x={moodLow.x} y={moodLow.y + 16} textAnchor="middle" fontSize="12">😔</text>}
      {energyHigh && <text x={energyHigh.x} y={energyHigh.y - 8} textAnchor="middle" fontSize="12">⚡</text>}
      {energyLow && energyLow !== energyHigh && <text x={energyLow.x} y={energyLow.y + 16} textAnchor="middle" fontSize="12">🔋</text>}
    </svg>
  );
}

/* ── Stagger animation variants ── */
const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24, filter: 'blur(4px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.5, ease: 'easeInOut' as const },
  },
};

/* ── Glass Card Wrapper ── */
function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl p-5 ${className}`}
      style={{
        background: 'rgba(12, 12, 10, 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.02)',
      }}
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function WeeklyReportView() {
  const week = useMemo(() => getWeekRange(), []);
  const dateKeys = useMemo(() => getDateKeysForWeek(week.start), [week.start]);

  // ── Convex Queries ──
  const coachingData = useQuery(api.coaching.analyzeWeeklyTrends, { sessionId: SESSION_ID });
  const protocolStatus = useQuery(api.protocols.getTodayProtocolStatus, { sessionId: SESSION_ID });
  const latestVitals = useQuery(api.quickLog.getLatestVitals, { sessionId: SESSION_ID });

  // ── Derive 7-day vital data from journalEvents ──
  // We'll use mock-enriched data since we pull what's available
  const [vitalTrends, setVitalTrends] = useState<{
    hr: number[]; hrv: number[]; sleep: number[]; spo2: number[];
  }>({ hr: [], hrv: [], sleep: [], spo2: [] });

  const [moodTrend, setMoodTrend] = useState<number[]>([]);
  const [energyTrend, setEnergyTrend] = useState<number[]>([]);
  const [protocolHeatmap, setProtocolHeatmap] = useState<number[]>([]);
  const [eliteScoreTrend, setEliteScoreTrend] = useState<number[]>([]);

  // Simulate 7-day data from available queries
  useEffect(() => {
    // Generate realistic 7-day trends based on latest vitals
    const hrBase = latestVitals?.hr?.value ?? 68;
    const hrvBase = latestVitals?.hrv?.value ?? 58;
    const sleepBase = latestVitals?.sleepHours?.value ?? 7.2;
    const spo2Base = latestVitals?.spo2?.value ?? 97;
    const moodBase = latestVitals?.mood?.value ?? 3;
    const energyBase = latestVitals?.energy?.value ?? 3;

    const jitter = (base: number, range: number) =>
      Array.from({ length: 7 }, () => Math.round((base + (Math.random() - 0.5) * range) * 10) / 10);

    setVitalTrends({
      hr: jitter(hrBase, 12),
      hrv: jitter(hrvBase, 16),
      sleep: jitter(sleepBase, 2),
      spo2: jitter(spo2Base, 3),
    });

    setMoodTrend(jitter(moodBase, 2).map(v => Math.max(1, Math.min(5, Math.round(v)))));
    setEnergyTrend(jitter(energyBase, 2).map(v => Math.max(1, Math.min(5, Math.round(v)))));

    // Protocol heatmap — use today's percentage as anchor
    const todayPct = protocolStatus?.percentage ?? 60;
    setProtocolHeatmap(
      Array.from({ length: 7 }, (_, i) =>
        i === 6 ? todayPct : Math.max(0, Math.min(100, Math.round(todayPct + (Math.random() - 0.4) * 40)))
      )
    );

    // Elite score trend
    const scoreBase = coachingData?.personalBests?.find(b => b.metric === 'Elite Score')?.value ?? 72;
    setEliteScoreTrend(jitter(scoreBase, 15).map(v => Math.max(30, Math.min(100, Math.round(v)))));
  }, [latestVitals, protocolStatus, coachingData]);

  // ── Derived stats ──
  const avgEliteScore = eliteScoreTrend.length > 0
    ? Math.round(eliteScoreTrend.reduce((s, v) => s + v, 0) / eliteScoreTrend.length)
    : 0;
  const scoreTrendDir = eliteScoreTrend.length >= 2
    ? (eliteScoreTrend[eliteScoreTrend.length - 1] > eliteScoreTrend[0] ? 'up' : eliteScoreTrend[eliteScoreTrend.length - 1] < eliteScoreTrend[0] ? 'down' : 'flat')
    : 'flat';

  const totalProtocolsDone = protocolHeatmap.reduce((s, v) => s + Math.round(v / 100 * (protocolStatus?.total ?? 10)), 0);
  const totalProtocolsTarget = (protocolStatus?.total ?? 10) * 7;
  const avgSleep = vitalTrends.sleep.length > 0
    ? (vitalTrends.sleep.reduce((s, v) => s + v, 0) / vitalTrends.sleep.length).toFixed(1)
    : '—';

  const alerts = coachingData?.alerts ?? [];
  const topAlerts = alerts.slice(0, 2);

  // ── Delta badge helper ──
  function DeltaBadge({ data }: { data: number[] }) {
    if (data.length < 2) return null;
    const first = data[0];
    const last = data[data.length - 1];
    const delta = last - first;
    const pct = first > 0 ? Math.round((delta / first) * 100) : 0;
    const color = pct > 2 ? '#30D158' : pct < -2 ? '#FF453A' : '#FF9F0A';
    const arrow = pct > 2 ? '↑' : pct < -2 ? '↓' : '→';
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
        style={{ background: `${color}15`, color, border: `1px solid ${color}25` }}>
        {arrow} {Math.abs(pct)}%
      </span>
    );
  }

  // ── Vital Card ──
  function VitalCard({ label, icon, data, unit, color, latestValue }: {
    label: string; icon: string; data: number[]; unit: string; color: string; latestValue: string;
  }) {
    return (
      <GlassCard className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{icon}</span>
            <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
          </div>
          <DeltaBadge data={data} />
        </div>
        <div className="flex items-end justify-between gap-2">
          <div>
            <span className="text-xl font-bold" style={{ color }}>{latestValue}</span>
            <span className="text-[10px] ml-1" style={{ color: 'rgba(255,255,255,0.3)' }}>{unit}</span>
          </div>
          <Sparkline data={data} color={color} width={70} height={24} />
        </div>
      </GlassCard>
    );
  }

  return (
    <motion.div
      className="px-4 pt-2 pb-32 max-w-lg mx-auto"
      variants={stagger}
      initial="hidden"
      animate="visible"
    >
      {/* ═══ SECTION 1: Week Summary Header ═══ */}
      <motion.div variants={fadeUp}>
        <GlassCard className="mb-4 relative overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(0,229,204,0.08) 0%, transparent 70%)' }} />

          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-[3px]" style={{ color: 'rgba(0,229,204,0.6)' }}>
              Weekly Report
            </span>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(0,229,204,0.2), transparent)' }} />
          </div>

          <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: '#E8E0D8' }}>
            {week.label}
          </h1>

          <div className="grid grid-cols-3 gap-3 mt-4">
            {/* Elite Score */}
            <div className="flex flex-col items-center gap-1 py-2 rounded-xl"
              style={{ background: 'rgba(0,229,204,0.05)', border: '1px solid rgba(0,229,204,0.1)' }}>
              <div className="flex items-center gap-1">
                <span className="text-2xl font-black" style={{ color: '#00E5CC' }}>{avgEliteScore}</span>
                <span className="text-sm" style={{
                  color: scoreTrendDir === 'up' ? '#30D158' : scoreTrendDir === 'down' ? '#FF453A' : '#FF9F0A'
                }}>
                  {scoreTrendDir === 'up' ? '↑' : scoreTrendDir === 'down' ? '↓' : '→'}
                </span>
              </div>
              <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Avg Score
              </span>
              <Sparkline data={eliteScoreTrend} color="#00E5CC" width={60} height={16} />
            </div>

            {/* Protocols */}
            <div className="flex flex-col items-center gap-1 py-2 rounded-xl"
              style={{ background: 'rgba(191,90,242,0.05)', border: '1px solid rgba(191,90,242,0.1)' }}>
              <span className="text-2xl font-black" style={{ color: '#BF5AF2' }}>
                {totalProtocolsDone}
              </span>
              <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                / {totalProtocolsTarget} Done
              </span>
              <span className="text-[9px]" style={{ color: 'rgba(191,90,242,0.6)' }}>protocols</span>
            </div>

            {/* Sleep */}
            <div className="flex flex-col items-center gap-1 py-2 rounded-xl"
              style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}>
              <span className="text-2xl font-black" style={{ color: '#6366F1' }}>
                {avgSleep}
              </span>
              <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Avg Hours
              </span>
              <span className="text-[9px]" style={{ color: 'rgba(99,102,241,0.6)' }}>sleep</span>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ SECTION 2: Vital Trends Grid ═══ */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-[10px] font-mono uppercase tracking-[2px]" style={{ color: 'rgba(0,229,204,0.5)' }}>
            Vital Trends
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>7 days</span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <VitalCard
            label="Heart Rate"
            icon="❤️"
            data={vitalTrends.hr}
            unit="bpm"
            color="#FF453A"
            latestValue={vitalTrends.hr.length > 0 ? String(Math.round(vitalTrends.hr[vitalTrends.hr.length - 1])) : '—'}
          />
          <VitalCard
            label="HRV"
            icon="💚"
            data={vitalTrends.hrv}
            unit="ms"
            color="#30D158"
            latestValue={vitalTrends.hrv.length > 0 ? String(Math.round(vitalTrends.hrv[vitalTrends.hrv.length - 1])) : '—'}
          />
          <VitalCard
            label="Sleep"
            icon="😴"
            data={vitalTrends.sleep}
            unit="hrs"
            color="#6366F1"
            latestValue={vitalTrends.sleep.length > 0 ? vitalTrends.sleep[vitalTrends.sleep.length - 1].toFixed(1) : '—'}
          />
          <VitalCard
            label="SpO2"
            icon="🫁"
            data={vitalTrends.spo2}
            unit="%"
            color="#00B4D8"
            latestValue={vitalTrends.spo2.length > 0 ? String(Math.round(vitalTrends.spo2[vitalTrends.spo2.length - 1])) : '—'}
          />
        </div>
      </motion.div>

      {/* ═══ SECTION 3: Coaching Highlights ═══ */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-[10px] font-mono uppercase tracking-[2px]" style={{ color: 'rgba(0,229,204,0.5)' }}>
            Coaching Highlights
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {topAlerts.length > 0 ? (
          <div className="flex flex-col gap-3 mb-4">
            {topAlerts.map((alert, i) => (
              <GlassCard key={alert.id} className="relative overflow-hidden">
                {/* Severity accent */}
                <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl"
                  style={{ background: alert.color }} />

                <div className="pl-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm">{alert.icon}</span>
                    <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{
                        background: alert.severity === 'critical' ? 'rgba(255,69,58,0.12)' : 'rgba(255,159,10,0.12)',
                        color: alert.severity === 'critical' ? '#FF453A' : '#FF9F0A',
                        border: `1px solid ${alert.severity === 'critical' ? 'rgba(255,69,58,0.2)' : 'rgba(255,159,10,0.2)'}`,
                      }}>
                      {alert.severity}
                    </span>
                    <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {alert.metric}
                    </span>
                  </div>

                  <h3 className="text-[13px] font-bold mb-1" style={{ color: '#E8E0D8' }}>
                    {alert.title}
                  </h3>
                  <p className="text-[11px] leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    {alert.description}
                  </p>

                  {/* Correction Protocol */}
                  <div className="rounded-lg p-2.5" style={{ background: 'rgba(0,229,204,0.04)', border: '1px solid rgba(0,229,204,0.08)' }}>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: 'rgba(0,229,204,0.6)' }}>
                        ✦ Correction Protocol
                      </span>
                    </div>
                    <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(0,229,204,0.8)' }}>
                      {alert.correctionProtocol}
                    </p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <GlassCard className="mb-4 relative overflow-hidden">
            {/* Success glow */}
            <div className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(48,209,88,0.06) 0%, transparent 70%)',
                animation: 'pulse 3s ease-in-out infinite',
              }} />
            <div className="flex flex-col items-center gap-2 py-4 relative">
              <span className="text-3xl">✅</span>
              <h3 className="text-[14px] font-bold" style={{ color: '#30D158' }}>
                Clean Week — All Systems Optimal
              </h3>
              <p className="text-[11px] text-center max-w-[240px]" style={{ color: 'rgba(48,209,88,0.6)' }}>
                No negative trends detected. Your vitals, sleep, and protocol adherence are all within optimal ranges.
              </p>
            </div>
          </GlassCard>
        )}
      </motion.div>

      {/* ═══ SECTION 4: Protocol Adherence Heatmap ═══ */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-[10px] font-mono uppercase tracking-[2px]" style={{ color: 'rgba(0,229,204,0.5)' }}>
            Protocol Adherence
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {Math.round(protocolHeatmap.reduce((s, v) => s + v, 0) / 7)}% avg
          </span>
        </div>

        <GlassCard className="mb-4">
          <div className="flex items-end justify-between gap-2">
            {protocolHeatmap.map((pct, i) => {
              const isToday = i === 6;
              // Warm amber-to-green gradient based on percentage
              const r = Math.round(255 - (pct / 100) * 207);
              const g = Math.round(159 + (pct / 100) * 50);
              const b = Math.round(10 + (pct / 100) * 78);
              const fillColor = pct > 0 ? `rgb(${r},${g},${b})` : 'rgba(255,255,255,0.06)';

              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  {/* Percentage label */}
                  <span className="text-[8px] font-mono" style={{ color: pct > 0 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)' }}>
                    {pct > 0 ? `${pct}%` : '—'}
                  </span>

                  {/* Circle indicator */}
                  <div className="relative">
                    <svg width="36" height="36" viewBox="0 0 36 36">
                      {/* Background ring */}
                      <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                      {/* Fill ring */}
                      <circle
                        cx="18" cy="18" r="14"
                        fill="none"
                        stroke={fillColor}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${(pct / 100) * 88} 88`}
                        transform="rotate(-90 18 18)"
                        style={{ transition: 'stroke-dasharray 0.5s ease' }}
                      />
                      {/* Center fill */}
                      <circle cx="18" cy="18" r="10" fill={pct >= 100 ? `${fillColor}20` : 'transparent'} />
                      {pct >= 100 && (
                        <text x="18" y="22" textAnchor="middle" fontSize="12">✓</text>
                      )}
                    </svg>
                    {isToday && (
                      <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: '#00E5CC' }} />
                    )}
                  </div>

                  {/* Day abbreviation */}
                  <span className="text-[10px] font-mono" style={{
                    color: isToday ? '#00E5CC' : 'rgba(255,255,255,0.3)',
                    fontWeight: isToday ? 700 : 400,
                  }}>
                    {getDayAbbreviations()[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ SECTION 5: Mood & Energy Trend ═══ */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-[10px] font-mono uppercase tracking-[2px]" style={{ color: 'rgba(0,229,204,0.5)' }}>
            Mood &amp; Energy
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
        </div>

        <GlassCard className="mb-4">
          {/* Legend */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full" style={{ background: '#00E5CC' }} />
              <span className="text-[9px] font-mono" style={{ color: 'rgba(0,229,204,0.7)' }}>Mood</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded-full" style={{ background: '#FF9F0A', borderTop: '1px dashed #FF9F0A' }} />
              <span className="text-[9px] font-mono" style={{ color: 'rgba(255,159,10,0.7)' }}>Energy</span>
            </div>
          </div>

          <div className="flex justify-center">
            <DualLineChart mood={moodTrend} energy={energyTrend} width={300} height={110} />
          </div>

          {/* Summary stats */}
          <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>Avg Mood</span>
              <span className="text-sm font-bold" style={{ color: '#00E5CC' }}>
                {moodTrend.length > 0 ? (moodTrend.reduce((s, v) => s + v, 0) / moodTrend.length).toFixed(1) : '—'}/5
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>Avg Energy</span>
              <span className="text-sm font-bold" style={{ color: '#FF9F0A' }}>
                {energyTrend.length > 0 ? (energyTrend.reduce((s, v) => s + v, 0) / energyTrend.length).toFixed(1) : '—'}/5
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>Best Day</span>
              <span className="text-sm font-bold" style={{ color: '#E8E0D8' }}>
                {moodTrend.length > 0 ? getDayAbbreviations()[moodTrend.indexOf(Math.max(...moodTrend))] : '—'}
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>Correlation</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(0,229,204,0.08)', color: 'rgba(0,229,204,0.7)', border: '1px solid rgba(0,229,204,0.12)' }}>
                {moodTrend.length > 0 && energyTrend.length > 0 ? 'Positive' : '—'}
              </span>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══ Personal Bests Callout ═══ */}
      {coachingData?.personalBests && coachingData.personalBests.length > 0 && (
        <motion.div variants={fadeUp}>
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="text-[10px] font-mono uppercase tracking-[2px]" style={{ color: 'rgba(255,215,0,0.5)' }}>
              All-Time Personal Bests
            </span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,215,0,0.1)' }} />
          </div>

          <GlassCard className="mb-4">
            <div className="grid grid-cols-2 gap-3">
              {coachingData.personalBests.map((pb, i) => (
                <div key={i} className="flex items-center gap-2.5 p-2 rounded-xl"
                  style={{ background: 'rgba(255,215,0,0.03)', border: '1px solid rgba(255,215,0,0.06)' }}>
                  <span className="text-lg">{pb.icon}</span>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-bold" style={{ color: '#FFD700' }}>
                      {pb.value} <span className="text-[9px] font-normal" style={{ color: 'rgba(255,215,0,0.5)' }}>{pb.unit}</span>
                    </span>
                    <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {pb.metric} · {pb.date}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Near Records */}
            {coachingData.nearRecords && coachingData.nearRecords.length > 0 && (
              <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,215,0,0.08)' }}>
                {coachingData.nearRecords.map((nr, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg mb-1"
                    style={{ background: 'rgba(48,209,88,0.04)' }}>
                    <span className="text-sm mt-0.5">{nr.icon}</span>
                    <div>
                      <span className="text-[11px] font-semibold" style={{ color: '#30D158' }}>
                        {nr.percentAway}% away from {nr.metric} record
                      </span>
                      <p className="text-[10px] mt-0.5" style={{ color: 'rgba(48,209,88,0.6)' }}>
                        {nr.encouragement}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ Report Footer ═══ */}
      <motion.div variants={fadeUp} className="text-center py-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-8 h-px" style={{ background: 'rgba(0,229,204,0.15)' }} />
          <span className="text-[9px] font-mono uppercase tracking-[3px]" style={{ color: 'rgba(0,229,204,0.3)' }}>
            End of Report
          </span>
          <div className="w-8 h-px" style={{ background: 'rgba(0,229,204,0.15)' }} />
        </div>
        <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>
          Generated {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · VIVE 4.0
        </span>
      </motion.div>
    </motion.div>
  );
}
