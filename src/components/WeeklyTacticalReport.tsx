import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface WeeklyTacticalReportProps {
  sessionId: string;
}

/* ── Readiness Grade Config ── */
const GRADE_CONFIG = {
  APEX: { label: 'APEX', color: '#00F2FF', bg: 'rgba(0,242,255,0.08)', border: 'rgba(0,242,255,0.2)', desc: 'Peak operational readiness' },
  COMBAT_READY: { label: 'COMBAT READY', color: '#34C759', bg: 'rgba(52,199,89,0.08)', border: 'rgba(52,199,89,0.2)', desc: 'Strong performance baseline' },
  RECOVERING: { label: 'RECOVERING', color: '#FF9F0A', bg: 'rgba(255,159,10,0.08)', border: 'rgba(255,159,10,0.2)', desc: 'Suboptimal — protocol gaps detected' },
  COMPROMISED: { label: 'COMPROMISED', color: '#FF453A', bg: 'rgba(255,69,58,0.08)', border: 'rgba(255,69,58,0.2)', desc: 'Critical — immediate intervention required' },
};

const VERDICT_CONFIG = {
  strong_positive: { label: 'STRONG', color: '#34C759', icon: '▲' },
  moderate_positive: { label: 'MODERATE', color: '#FF9F0A', icon: '◆' },
  weak: { label: 'WEAK', color: 'rgba(255,255,255,0.3)', icon: '○' },
  negative: { label: 'MISSED', color: '#FF453A', icon: '▼' },
};

const STATUS_COLORS = {
  optimal: '#34C759',
  borderline: '#FF9F0A',
  flagged: '#FF453A',
  no_data: 'rgba(255,255,255,0.15)',
};

/* ── Mini Sparkline ── */
function Sparkline({ data, color, height = 28 }: { data: number[]; color: string; height?: number }) {
  if (data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100;
  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="flex-shrink-0">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,${height} ${points} ${w},${height}`} fill={`url(#spark-${color.replace('#', '')})`} />
    </svg>
  );
}

/* ── Circular Score Gauge ── */
function ScoreGauge({ score, size = 140, color, label }: { score: number; size?: number; color: string; label: string }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div className="flex flex-col items-center z-10">
        <motion.span
          className="text-[32px] font-bold tracking-tight font-mono"
          style={{ color }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          {score}
        </motion.span>
        <span className="text-[8px] font-mono uppercase tracking-[0.15em] -mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {label}
        </span>
      </div>
    </div>
  );
}

/* ── Score Breakdown Bar ── */
function BreakdownBar({ label, score, weight, contribution, color, delay }: {
  label: string; score: number; weight: number; contribution: number; color: string; delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }} className="flex items-center gap-3">
      <span className="text-[10px] font-mono w-[72px] text-right" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8, delay: delay + 0.2 }} style={{ background: color, boxShadow: `0 0 8px ${color}30` }} />
      </div>
      <span className="text-[9px] font-mono w-[32px]" style={{ color }}>+{contribution}</span>
      <span className="text-[8px] font-mono w-[24px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{weight}%</span>
    </motion.div>
  );
}

/* ── Delta Badge ── */
function DeltaBadge({ value, suffix = '' }: { value: number | null; suffix?: string }) {
  if (value === null) return <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>;
  const isPositive = value > 0;
  const color = isPositive ? '#34C759' : value < 0 ? '#FF453A' : 'rgba(255,255,255,0.3)';
  return (
    <span className="text-[9px] font-mono font-medium" style={{ color }}>
      {isPositive ? '▲' : value < 0 ? '▼' : '–'} {Math.abs(value)}{suffix}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COMMANDER'S DEBRIEF — Printable Summary Card
   ═══════════════════════════════════════════════════════════════ */
function CommandersDebrief({ report, commandersNote, isLoadingNote, onGenerateNote }: {
  report: any;
  commandersNote: string | null;
  isLoadingNote: boolean;
  onGenerateNote: () => void;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const grade = GRADE_CONFIG[report.readinessGrade as keyof typeof GRADE_CONFIG];
  const overallAdherence = report.protocolStats.length > 0
    ? Math.round(report.protocolStats.reduce((s: number, p: any) => s + p.completionRate, 0) / report.protocolStats.length)
    : 0;

  // Top 3 wins: protocols with highest completion + streak
  const wins = [...report.protocolStats]
    .filter((p: any) => p.completionRate >= 60)
    .sort((a: any, b: any) => (b.completionRate + b.streak * 10) - (a.completionRate + a.streak * 10))
    .slice(0, 3)
    .map((p: any) => ({
      name: p.name,
      icon: p.icon,
      rate: p.completionRate,
      streak: p.streak,
    }));

  // Top 3 areas to improve: lowest completion protocols
  const improvements = [...report.protocolStats]
    .filter((p: any) => p.completionRate < 60)
    .sort((a: any, b: any) => a.completionRate - b.completionRate)
    .slice(0, 3)
    .map((p: any) => ({
      name: p.name,
      icon: p.icon,
      rate: p.completionRate,
      daysCompleted: p.daysCompleted,
    }));

  const handlePrint = useCallback(() => {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>VIVE Tactical Debrief — ${report.reportPeriod.start} to ${report.reportPeriod.end}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0A0A12; color: #fff; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; padding: 32px; }
  .debrief-card { background: linear-gradient(135deg, #0D0D1A, #12101F); border: 1px solid ${grade.border}; border-radius: 16px; padding: 28px; max-width: 680px; margin: 0 auto; }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .score-circle { width: 72px; height: 72px; border-radius: 50%; border: 3px solid ${grade.color}; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; color: ${grade.color}; }
  .grade-badge { display: inline-block; font-size: 9px; font-weight: 700; letter-spacing: 0.15em; padding: 3px 10px; border-radius: 4px; background: ${grade.bg}; color: ${grade.color}; border: 1px solid ${grade.border}; }
  .period { font-size: 9px; color: rgba(255,255,255,0.3); margin-top: 4px; }
  .section { margin-top: 18px; }
  .section-title { font-size: 8px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.25); margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .metric-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; }
  .metric-icon { font-size: 14px; width: 22px; text-align: center; }
  .metric-name { font-size: 11px; color: rgba(255,255,255,0.7); flex: 1; }
  .metric-value { font-size: 11px; font-weight: 700; }
  .metric-bar { width: 48px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.04); overflow: hidden; }
  .metric-bar-fill { height: 100%; border-radius: 2px; }
  .green { color: #34C759; }
  .amber { color: #FF9F0A; }
  .red { color: #FF453A; }
  .cyan { color: #00F2FF; }
  .adherence-big { font-size: 36px; font-weight: 800; letter-spacing: -1px; }
  .commanders-note { font-size: 11px; line-height: 1.7; color: rgba(255,255,255,0.6); padding: 14px; background: rgba(255,255,255,0.02); border-radius: 8px; border-left: 2px solid ${grade.color}; margin-top: 8px; }
  .footer { text-align: center; margin-top: 20px; font-size: 7px; letter-spacing: 0.2em; color: rgba(255,255,255,0.15); }
  @media print { body { background: #0A0A12 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>${printContent}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  }, [report, grade]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 mb-2">
        {!commandersNote && !isLoadingNote && (
          <button
            onClick={onGenerateNote}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-mono font-bold tracking-wider uppercase transition-all duration-200 hover:scale-[1.02]"
            style={{
              background: 'rgba(0,242,255,0.06)',
              border: '1px solid rgba(0,242,255,0.15)',
              color: '#00F2FF',
            }}
          >
            <span>⚡</span> Generate Commander&apos;s Note
          </button>
        )}
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-mono font-bold tracking-wider uppercase transition-all duration-200 hover:scale-[1.02]"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          <span>🖨</span> Print / Export
        </button>
      </div>

      {/* Printable card */}
      <div ref={printRef}>
        <div className="debrief-card rounded-2xl relative overflow-hidden" style={{
          background: 'linear-gradient(135deg, rgba(13,13,26,0.98), rgba(18,16,31,0.95))',
          border: `1px solid ${grade.border}`,
          boxShadow: `0 0 40px ${grade.color}06, 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)`,
          padding: '24px',
        }}>
          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }} />

          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-12 h-px" style={{ background: `linear-gradient(90deg, ${grade.color}40, transparent)` }} />
          <div className="absolute top-0 left-0 h-12 w-px" style={{ background: `linear-gradient(180deg, ${grade.color}40, transparent)` }} />
          <div className="absolute bottom-0 right-0 w-12 h-px" style={{ background: `linear-gradient(270deg, ${grade.color}40, transparent)` }} />
          <div className="absolute bottom-0 right-0 h-12 w-px" style={{ background: `linear-gradient(0deg, ${grade.color}40, transparent)` }} />

          <div className="relative z-10">
            {/* ── Header ── */}
            <div className="flex items-center gap-4 pb-4 mb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex-shrink-0 w-[72px] h-[72px] rounded-full flex items-center justify-center" style={{
                border: `3px solid ${grade.color}`,
                boxShadow: `0 0 16px ${grade.color}15, inset 0 0 12px ${grade.color}08`,
              }}>
                <span className="text-[28px] font-extrabold font-mono" style={{ color: grade.color }}>{report.readinessScore}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-mono font-bold tracking-[0.15em] px-2 py-0.5 rounded" style={{
                    background: grade.bg, color: grade.color, border: `1px solid ${grade.border}`,
                  }}>
                    {grade.label}
                  </span>
                  <span className="text-[7px] font-mono tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    CLASSIFICATION
                  </span>
                </div>
                <h2 className="text-[14px] font-bold tracking-wide" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  TACTICAL DEBRIEF
                </h2>
                <p className="text-[9px] font-mono mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {report.reportPeriod.start} → {report.reportPeriod.end}
                </p>
              </div>
              {/* Adherence big number */}
              <div className="flex flex-col items-center flex-shrink-0">
                <span className="text-[36px] font-extrabold font-mono leading-none" style={{
                  color: overallAdherence >= 70 ? '#34C759' : overallAdherence >= 40 ? '#FF9F0A' : '#FF453A',
                  textShadow: `0 0 20px ${overallAdherence >= 70 ? 'rgba(52,199,89,0.2)' : overallAdherence >= 40 ? 'rgba(255,159,10,0.2)' : 'rgba(255,69,58,0.2)'}`,
                }}>
                  {overallAdherence}%
                </span>
                <span className="text-[7px] font-mono uppercase tracking-[0.2em] mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  ADHERENCE
                </span>
              </div>
            </div>

            {/* ── Week Deltas ── */}
            <div className="flex items-center gap-6 mb-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>Adherence WoW</span>
                <DeltaBadge value={report.weekOverWeek.adherenceDelta} suffix="%" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>Sleep WoW</span>
                <DeltaBadge value={report.weekOverWeek.sleepDelta} suffix="pts" />
              </div>
            </div>

            {/* ── Top 3 Wins ── */}
            <div className="mb-4">
              <div className="text-[8px] font-mono font-bold tracking-[0.2em] uppercase mb-2 pb-1" style={{
                color: 'rgba(52,199,89,0.5)',
                borderBottom: '1px solid rgba(52,199,89,0.08)',
              }}>
                ▲ TOP WINS
              </div>
              {wins.length === 0 ? (
                <p className="text-[10px] font-mono py-2" style={{ color: 'rgba(255,255,255,0.2)' }}>No protocols above 60% this week</p>
              ) : (
                <div className="space-y-1.5">
                  {wins.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 py-1 px-2 rounded-lg" style={{ background: 'rgba(52,199,89,0.03)' }}>
                      <span className="text-[13px] w-5 text-center">{w.icon}</span>
                      <span className="text-[11px] font-medium flex-1" style={{ color: 'rgba(255,255,255,0.75)' }}>{w.name}</span>
                      <div className="w-[48px] h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="h-full rounded-full" style={{ width: `${w.rate}%`, background: '#34C759' }} />
                      </div>
                      <span className="text-[10px] font-mono font-bold w-[32px] text-right" style={{ color: '#34C759' }}>{w.rate}%</span>
                      {w.streak >= 3 && <span className="text-[9px]">🔥{w.streak}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Top 3 Areas to Improve ── */}
            <div className="mb-4">
              <div className="text-[8px] font-mono font-bold tracking-[0.2em] uppercase mb-2 pb-1" style={{
                color: 'rgba(255,69,58,0.5)',
                borderBottom: '1px solid rgba(255,69,58,0.08)',
              }}>
                ▼ AREAS TO IMPROVE
              </div>
              {improvements.length === 0 ? (
                <p className="text-[10px] font-mono py-2" style={{ color: 'rgba(255,255,255,0.2)' }}>All protocols above 60% — outstanding</p>
              ) : (
                <div className="space-y-1.5">
                  {improvements.map((imp, i) => (
                    <div key={i} className="flex items-center gap-2 py-1 px-2 rounded-lg" style={{ background: 'rgba(255,69,58,0.03)' }}>
                      <span className="text-[13px] w-5 text-center">{imp.icon}</span>
                      <span className="text-[11px] font-medium flex-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{imp.name}</span>
                      <div className="w-[48px] h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.max(imp.rate, 4)}%`, background: imp.rate < 20 ? '#FF453A' : '#FF9F0A' }} />
                      </div>
                      <span className="text-[10px] font-mono font-bold w-[32px] text-right" style={{ color: imp.rate < 20 ? '#FF453A' : '#FF9F0A' }}>
                        {imp.rate}%
                      </span>
                      <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>{imp.daysCompleted}/7d</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Commander's Note ── */}
            <div>
              <div className="text-[8px] font-mono font-bold tracking-[0.2em] uppercase mb-2 pb-1" style={{
                color: `${grade.color}80`,
                borderBottom: `1px solid ${grade.color}10`,
              }}>
                ★ COMMANDER&apos;S NOTE
              </div>
              {isLoadingNote ? (
                <div className="flex items-center gap-2 py-4 px-3 rounded-lg" style={{
                  background: 'rgba(255,255,255,0.02)',
                  borderLeft: `2px solid ${grade.color}30`,
                }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="w-4 h-4 rounded-full border-2 flex-shrink-0"
                    style={{ borderColor: `${grade.color}20`, borderTopColor: grade.color }}
                  />
                  <span className="text-[10px] font-mono" style={{ color: `${grade.color}50` }}>
                    GENERATING TACTICAL ASSESSMENT...
                  </span>
                </div>
              ) : commandersNote ? (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-3 px-4 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderLeft: `2px solid ${grade.color}`,
                    boxShadow: `inset 4px 0 12px ${grade.color}06`,
                  }}
                >
                  <p className="text-[11px] leading-[1.75] font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {commandersNote}
                  </p>
                </motion.div>
              ) : (
                <div className="py-3 px-4 rounded-lg" style={{
                  background: 'rgba(255,255,255,0.015)',
                  borderLeft: '2px solid rgba(255,255,255,0.06)',
                }}>
                  <p className="text-[10px] font-mono italic" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    Tap &quot;Generate Commander&apos;s Note&quot; above to receive your AI tactical assessment.
                  </p>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="flex items-center justify-center gap-2 mt-5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
              <div className="w-6 h-px" style={{ background: `linear-gradient(90deg, transparent, ${grade.color}15)` }} />
              <span className="text-[7px] font-mono tracking-[0.2em] uppercase" style={{ color: `${grade.color}20` }}>
                VIVE TACTICAL INTELLIGENCE — CLASSIFIED
              </span>
              <div className="w-6 h-px" style={{ background: `linear-gradient(90deg, ${grade.color}15, transparent)` }} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export function WeeklyTacticalReport({ sessionId }: WeeklyTacticalReportProps) {
  const report = useQuery(api.weeklyTacticalReport.getWeeklyTacticalReport, sessionId ? { sessionId } : 'skip');
  const generateNote = useAction(api.commandersNote.generateCommandersNote);
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');
  const [commandersNote, setCommandersNote] = useState<string | null>(null);
  const [isLoadingNote, setIsLoadingNote] = useState(false);

  const handleGenerateNote = useCallback(async () => {
    if (!report || isLoadingNote) return;
    setIsLoadingNote(true);
    try {
      const overallAdherence = report.protocolStats.length > 0
        ? Math.round(report.protocolStats.reduce((s: number, p: any) => s + p.completionRate, 0) / report.protocolStats.length)
        : 0;

      const wins = [...report.protocolStats]
        .filter((p: any) => p.completionRate >= 60)
        .sort((a: any, b: any) => b.completionRate - a.completionRate)
        .slice(0, 3)
        .map((p: any) => `${p.name} at ${p.completionRate}%`);

      const failures = [...report.protocolStats]
        .filter((p: any) => p.completionRate < 40)
        .sort((a: any, b: any) => a.completionRate - b.completionRate)
        .slice(0, 3)
        .map((p: any) => `${p.name} at ${p.completionRate}%`);

      const bioSummary = report.biomarkerStatus
        .filter((m: any) => m.status !== 'no_data')
        .map((m: any) => `${m.label}: ${m.value} ${m.unit} (${m.status})`)
        .join(', ') || 'No biomarker data';

      const result = await generateNote({
        readinessScore: report.readinessScore,
        readinessGrade: report.readinessGrade,
        overallAdherence,
        sleepAvgScore: report.sleepMetrics.avgScore ?? undefined,
        sleepAvgHours: report.sleepMetrics.avgHours ?? undefined,
        avgHrv: report.avgHrv ?? undefined,
        biomarkerSummary: bioSummary,
        topWins: wins,
        topFailures: failures,
        adherenceDelta: report.weekOverWeek.adherenceDelta ?? undefined,
        sleepDelta: report.weekOverWeek.sleepDelta ?? undefined,
      });
      setCommandersNote(result.note);
    } catch (err) {
      console.error('[WeeklyTacticalReport] Failed to generate note:', err);
      setCommandersNote('Commander\'s Note generation failed. Review the data manually and maintain protocol discipline.');
    } finally {
      setIsLoadingNote(false);
    }
  }, [report, generateNote, isLoadingNote]);

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 rounded-full border-2"
          style={{ borderColor: 'rgba(0,242,255,0.15)', borderTopColor: '#00F2FF' }}
        />
        <span className="text-[10px] font-mono" style={{ color: 'rgba(0,242,255,0.4)' }}>
          COMPILING TACTICAL REPORT...
        </span>
      </div>
    );
  }

  const grade = GRADE_CONFIG[report.readinessGrade];
  const { scoreBreakdown, sleepMetrics, biomarkerStatus, protocolStats, topCorrelations, failures, dailyAdherence } = report;
  const toggleSection = (id: string) => setExpandedSection(prev => prev === id ? null : id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">

      {/* ═══ COMMANDER'S DEBRIEF SUMMARY CARD ═══ */}
      <CommandersDebrief
        report={report}
        commandersNote={commandersNote}
        isLoadingNote={isLoadingNote}
        onGenerateNote={handleGenerateNote}
      />

      {/* ═══ REPORT HEADER ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(10,10,18,0.95), rgba(15,12,25,0.9))',
          border: `1px solid ${grade.border}`,
          boxShadow: `0 0 24px ${grade.color}08, inset 0 1px 0 rgba(255,255,255,0.03)`,
        }}
      >
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }} />
        <div className="relative flex items-start gap-4">
          <ScoreGauge score={report.readinessScore} color={grade.color} label="READINESS" />
          <div className="flex-1 pt-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-mono font-bold tracking-[0.15em] px-2 py-0.5 rounded" style={{ background: grade.bg, color: grade.color, border: `1px solid ${grade.border}` }}>
                {grade.label}
              </span>
              <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>CLASSIFICATION</span>
            </div>
            <h3 className="text-[13px] font-semibold tracking-wide mb-0.5" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Weekly Tactical Report
            </h3>
            <p className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {report.reportPeriod.start} → {report.reportPeriod.end}
            </p>
            <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{grade.desc}</p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-mono uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>Adherence</span>
                <DeltaBadge value={report.weekOverWeek.adherenceDelta} suffix="%" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-mono uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>Sleep</span>
                <DeltaBadge value={report.weekOverWeek.sleepDelta} suffix="pts" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ SCORE BREAKDOWN ═══ */}
      <SectionAccordion id="overview" title="Score Breakdown" icon="📊" expanded={expandedSection === 'overview'} onToggle={() => toggleSection('overview')} badge={`${report.readinessScore}/100`} badgeColor={grade.color}>
        <div className="space-y-2.5 pt-1">
          <BreakdownBar label="Adherence" score={scoreBreakdown.adherence.score} weight={scoreBreakdown.adherence.weight} contribution={scoreBreakdown.adherence.contribution} color="#A855F7" delay={0} />
          <BreakdownBar label="Sleep" score={scoreBreakdown.sleep.score} weight={scoreBreakdown.sleep.weight} contribution={scoreBreakdown.sleep.contribution} color="#00F2FF" delay={0.05} />
          <BreakdownBar label="Biomarkers" score={scoreBreakdown.biomarkers.score} weight={scoreBreakdown.biomarkers.weight} contribution={scoreBreakdown.biomarkers.contribution} color="#34C759" delay={0.1} />
          <BreakdownBar label="HRV" score={scoreBreakdown.hrv.score} weight={scoreBreakdown.hrv.weight} contribution={scoreBreakdown.hrv.contribution} color="#FF9F0A" delay={0.15} />
        </div>
      </SectionAccordion>

      {/* ═══ SLEEP INTEL ═══ */}
      <SectionAccordion id="sleep" title="Sleep Intelligence" icon="🌙" expanded={expandedSection === 'sleep'} onToggle={() => toggleSection('sleep')} badge={sleepMetrics.avgScore != null ? `${sleepMetrics.avgScore}` : '—'} badgeColor={sleepMetrics.avgScore != null && sleepMetrics.avgScore >= 75 ? '#34C759' : sleepMetrics.avgScore != null && sleepMetrics.avgScore >= 50 ? '#FF9F0A' : '#FF453A'}>
        {sleepMetrics.nightsLogged === 0 ? (
          <div className="text-center py-4">
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>No sleep data logged this week</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Sparkline data={sleepMetrics.dailyScores.map((d: any) => d.score)} color="#00F2FF" height={32} />
              <div className="flex flex-col">
                <span className="text-[8px] font-mono uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>7-Day Trend</span>
                <span className="text-[10px] font-mono" style={{ color: sleepMetrics.trend === 'up' ? '#34C759' : sleepMetrics.trend === 'down' ? '#FF453A' : 'rgba(255,255,255,0.4)' }}>
                  {sleepMetrics.trend === 'up' ? '▲ Improving' : sleepMetrics.trend === 'down' ? '▼ Declining' : '— Stable'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Avg Score', value: sleepMetrics.avgScore, unit: '/100', color: '#00F2FF' },
                { label: 'Avg Hours', value: sleepMetrics.avgHours, unit: 'h', color: '#A855F7' },
                { label: 'Efficiency', value: sleepMetrics.avgEfficiency, unit: '%', color: '#34C759' },
              ].map((m, i) => (
                <div key={i} className="rounded-lg p-2 text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="text-[16px] font-bold font-mono" style={{ color: m.color }}>
                    {m.value ?? '—'}<span className="text-[9px] opacity-50">{m.value != null ? m.unit : ''}</span>
                  </div>
                  <div className="text-[8px] font-mono uppercase mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{m.label}</div>
                </div>
              ))}
            </div>
            {(sleepMetrics.avgDeepPct != null || sleepMetrics.avgRemPct != null) && (
              <div className="flex items-center gap-3">
                {sleepMetrics.avgDeepPct != null && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: '#6366F1' }} />
                    <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>Deep {sleepMetrics.avgDeepPct}%</span>
                  </div>
                )}
                {sleepMetrics.avgRemPct != null && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: '#EC4899' }} />
                    <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>REM {sleepMetrics.avgRemPct}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SectionAccordion>

      {/* ═══ BIOMARKER STATUS ═══ */}
      <SectionAccordion id="biomarkers" title="Biomarker Status" icon="🧪" expanded={expandedSection === 'biomarkers'} onToggle={() => toggleSection('biomarkers')} badge={`${biomarkerStatus.filter((m: any) => m.status === 'optimal').length}/${biomarkerStatus.filter((m: any) => m.status !== 'no_data').length || biomarkerStatus.length}`} badgeColor="#34C759">
        <div className="space-y-1.5">
          {biomarkerStatus.map((marker: any, idx: number) => (
            <motion.div
              key={marker.key}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg"
              style={{ background: marker.status !== 'no_data' ? `${STATUS_COLORS[marker.status as keyof typeof STATUS_COLORS]}06` : 'transparent' }}
            >
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[marker.status as keyof typeof STATUS_COLORS], boxShadow: marker.status === 'optimal' ? `0 0 6px ${STATUS_COLORS.optimal}40` : 'none' }} />
              <span className="text-[11px] font-medium flex-1" style={{ color: 'rgba(255,255,255,0.7)' }}>{marker.label}</span>
              {marker.value != null ? (
                <span className="text-[11px] font-mono font-bold" style={{ color: STATUS_COLORS[marker.status as keyof typeof STATUS_COLORS] }}>
                  {marker.value} <span className="text-[8px] opacity-50">{marker.unit}</span>
                </span>
              ) : (
                <span className="text-[9px] font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>NO DATA</span>
              )}
              <span className="text-[7px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded" style={{
                background: `${STATUS_COLORS[marker.status as keyof typeof STATUS_COLORS]}12`,
                color: STATUS_COLORS[marker.status as keyof typeof STATUS_COLORS],
                border: `1px solid ${STATUS_COLORS[marker.status as keyof typeof STATUS_COLORS]}25`,
              }}>
                {marker.status === 'no_data' ? '—' : marker.status}
              </span>
            </motion.div>
          ))}
        </div>
      </SectionAccordion>

      {/* ═══ PROTOCOL CORRELATIONS ═══ */}
      <SectionAccordion id="correlations" title="Protocol → Recovery Correlations" icon="🔗" expanded={expandedSection === 'correlations'} onToggle={() => toggleSection('correlations')} badge={`${topCorrelations.filter((c: any) => c.verdict === 'strong_positive').length} strong`} badgeColor="#34C759">
        {topCorrelations.length === 0 ? (
          <div className="text-center py-4">
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>No protocol data to correlate</span>
          </div>
        ) : (
          <div className="space-y-2">
            {topCorrelations.map((corr: any, idx: number) => {
              const vc = VERDICT_CONFIG[corr.verdict as keyof typeof VERDICT_CONFIG];
              return (
                <motion.div key={idx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="rounded-lg p-3" style={{ background: `${vc.color}04`, border: `1px solid ${vc.color}15` }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[14px]">{corr.protocolIcon}</span>
                    <span className="text-[11px] font-semibold flex-1" style={{ color: 'rgba(255,255,255,0.8)' }}>{corr.protocolName}</span>
                    <span className="text-[8px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded" style={{ background: `${vc.color}15`, color: vc.color, border: `1px solid ${vc.color}25` }}>
                      {vc.icon} {vc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      <div className="h-full rounded-full" style={{ width: `${corr.adherenceRate}%`, background: vc.color, boxShadow: `0 0 4px ${vc.color}30` }} />
                    </div>
                    <span className="text-[9px] font-mono" style={{ color: vc.color }}>{corr.adherenceRate}%</span>
                  </div>
                  <p className="text-[9px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>{corr.mechanism}</p>
                </motion.div>
              );
            })}
          </div>
        )}
      </SectionAccordion>

      {/* ═══ ADHERENCE TIMELINE ═══ */}
      <SectionAccordion id="adherence" title="Adherence Timeline" icon="📈" expanded={expandedSection === 'adherence'} onToggle={() => toggleSection('adherence')} badge={`${(report as any).overallAdherence ?? 0}%`} badgeColor={((report as any).overallAdherence ?? 0) >= 70 ? '#34C759' : ((report as any).overallAdherence ?? 0) >= 40 ? '#FF9F0A' : '#FF453A'}>
        <div className="space-y-3">
          <div className="flex items-end gap-1.5 h-[48px]">
            {dailyAdherence.map((day: any, i: number) => {
              const h = Math.max(4, (day.rate / 100) * 44);
              const dayLabel = new Date(day.date + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }).slice(0, 2);
              const color = day.rate >= 70 ? '#34C759' : day.rate >= 40 ? '#FF9F0A' : day.rate > 0 ? '#FF453A' : 'rgba(255,255,255,0.06)';
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div className="w-full rounded-sm" initial={{ height: 0 }} animate={{ height: h }} transition={{ delay: i * 0.06, duration: 0.4 }} style={{ background: color, boxShadow: day.rate > 0 ? `0 0 6px ${color}25` : 'none' }} />
                  <span className="text-[7px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>{dayLabel}</span>
                </div>
              );
            })}
          </div>
          <div className="space-y-1">
            {protocolStats.slice(0, 6).map((ps: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 py-1">
                <span className="text-[12px] w-5 text-center">{ps.icon}</span>
                <span className="text-[10px] flex-1 truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>{ps.name}</span>
                <div className="w-[60px] h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div className="h-full rounded-full" style={{ width: `${ps.completionRate}%`, background: ps.completionRate >= 70 ? '#34C759' : ps.completionRate >= 40 ? '#FF9F0A' : '#FF453A' }} />
                </div>
                <span className="text-[9px] font-mono w-[28px] text-right" style={{ color: ps.completionRate >= 70 ? '#34C759' : ps.completionRate >= 40 ? '#FF9F0A' : '#FF453A' }}>{ps.completionRate}%</span>
                {ps.streak >= 3 && <span className="text-[8px]">🔥</span>}
              </div>
            ))}
          </div>
        </div>
      </SectionAccordion>

      {/* ═══ FAILURES / INTERVENTIONS ═══ */}
      {failures.length > 0 && (
        <SectionAccordion id="failures" title="Intervention Required" icon="⚠️" expanded={expandedSection === 'failures'} onToggle={() => toggleSection('failures')} badge={`${failures.length}`} badgeColor="#FF453A">
          <div className="space-y-2">
            {failures.map((f: any, idx: number) => (
              <motion.div key={idx} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} className="rounded-lg p-3" style={{ background: 'rgba(255,69,58,0.04)', border: '1px solid rgba(255,69,58,0.12)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px]">{f.icon}</span>
                  <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>{f.name}</span>
                  <span className="text-[9px] font-mono ml-auto" style={{ color: '#FF453A' }}>{f.daysCompleted}/7 days</span>
                </div>
                <p className="text-[9px] leading-relaxed pl-6" style={{ color: 'rgba(255,159,10,0.7)' }}>{f.recommendation}</p>
              </motion.div>
            ))}
          </div>
        </SectionAccordion>
      )}

      {/* ═══ REPORT FOOTER ═══ */}
      <div className="flex items-center justify-center gap-2 pt-2 pb-1">
        <div className="w-8 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,242,255,0.1))' }} />
        <span className="text-[8px] font-mono tracking-[0.15em]" style={{ color: 'rgba(0,242,255,0.2)' }}>VIVE TACTICAL INTELLIGENCE</span>
        <div className="w-8 h-px" style={{ background: 'linear-gradient(90deg, rgba(0,242,255,0.1), transparent)' }} />
      </div>
    </motion.div>
  );
}

/* ═══ ACCORDION SECTION ═══ */
function SectionAccordion({ id, title, icon, expanded, onToggle, badge, badgeColor, children }: {
  id: string; title: string; icon: string; expanded: boolean; onToggle: () => void;
  badge: string; badgeColor: string; children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl overflow-hidden" style={{
      background: expanded ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)',
      border: `1px solid ${expanded ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'}`,
    }}>
      <button onClick={onToggle} className="w-full flex items-center gap-2.5 px-3.5 py-3 transition-all duration-200">
        <span className="text-[13px]">{icon}</span>
        <span className="text-[11px] font-semibold flex-1 text-left" style={{ color: 'rgba(255,255,255,0.8)' }}>{title}</span>
        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: `${badgeColor}12`, color: badgeColor, border: `1px solid ${badgeColor}20` }}>{badge}</span>
        <motion.svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <path d="m6 9 6 6 6-6" />
        </motion.svg>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="px-3.5 pb-3.5">
              <div className="h-px mb-3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)' }} />
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
