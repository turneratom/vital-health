import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from 'convex/react';
import { getTwinSessionId } from '@/lib/twinSession';
import { api } from '../../../convex/_generated/api';
import { usePerformanceScore } from '@/features/dashboard/hooks/usePerformanceScore';
import { DailyStackHeaderWidget } from '@/components/DailyStack';
import type { ViewId } from "@/components/layout/ViewManager";

/* ═══════════════════════════════════════════════════════════════
   TOP HEADER — Global Performance Header
   
   Persistently displays:
   - Elite Score ring (always visible)
   - System Status indicator (Convex connection + vitals sync)
   - Cmd+K trigger button
   - Warm glassmorphism aesthetic
   ═══════════════════════════════════════════════════════════════ */

/* ── Elite Score Mini Ring ── */
function EliteScoreRing({ score, ghostMode }: { score: number; ghostMode: boolean }) {
  const r = 12;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, score));
  const off = c - (pct / 100) * c;

  const color = useMemo(() => {
    if (ghostMode) return 'rgba(160,160,160,0.6)';
    if (score >= 80) return '#7CB68E';
    if (score >= 60) return '#E8976C';
    if (score >= 40) return '#C4A46C';
    return '#D4847A';
  }, [score, ghostMode]);

  const trackColor = ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(232,151,108,0.06)';

  return (
    <div className="relative w-8 h-8 flex items-center justify-center group cursor-default">
      <svg viewBox="0 0 30 30" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="15" cy="15" r={r} fill="none" stroke={trackColor} strokeWidth="2.5" />
        <circle
          cx="15" cy="15" r={r} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          style={{
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease',
            filter: ghostMode ? 'none' : `drop-shadow(0 0 4px ${color}66)`,
          }}
        />
      </svg>
      <span
        className="absolute typo-data text-[9px] font-bold"
        style={{ color, textShadow: ghostMode ? 'none' : `0 0 6px ${color}44` }}
      >
        {score}
      </span>

      {/* Tooltip on hover */}
      <div
        className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50"
        style={{
          background: 'rgba(26,24,22,0.95)',
          border: '1px solid rgba(232,151,108,0.15)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        <span className="text-[10px] font-semibold" style={{ color: '#E8E0D8' }}>Vitality Index</span>
        <span className="text-[9px] ml-1.5" style={{ color: '#8A7E72' }}>
          {score >= 80 ? 'Peak Coherence' : score >= 60 ? 'Calibrated' : score >= 40 ? 'Modulating' : 'Sub-Threshold'}
        </span>
      </div>
    </div>
  );
}

/* ── System Status Indicator ── */
function SystemStatus({ ghostMode }: { ghostMode: boolean }) {
  const health = useQuery(api.queries.connectionHealth) ?? null;
  const isConnected = (health as any)?.status === 'connected';

  const dotColor = useMemo(() => {
    if (ghostMode) return 'rgba(160,160,160,0.5)';
    return isConnected ? '#7CB68E' : '#C4A46C';
  }, [isConnected, ghostMode]);

  const label = isConnected ? 'Bio-Systems Nominal' : 'Calibrating…';

  return (
    <div className="flex items-center gap-1.5 cursor-default group relative">
      <div className="relative w-1.5 h-1.5">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: dotColor,
            opacity: 0.3,
            animation: isConnected ? 'statusDotPulse 3s ease-in-out infinite' : 'statusDotPulse 1.5s ease-in-out infinite',
          }}
        />
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
        />
      </div>
      <span
        className="text-[8px] font-mono uppercase tracking-[0.08em] hidden sm:inline"
        style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(138,126,114,0.5)' }}
      >
        {label}
      </span>

      {/* Tooltip */}
      <div
        className="absolute top-full mt-2 right-0 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50"
        style={{
          background: 'rgba(26,24,22,0.95)',
          border: '1px solid rgba(42,38,34,0.8)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />
          <span className="text-[10px] font-semibold" style={{ color: '#E8E0D8' }}>
            {isConnected ? 'All Systems Synchronized' : 'Re-Calibrating Streams'}
          </span>
        </div>
        <div className="text-[9px]" style={{ color: '#8A7E72' }}>
          Convex · Vitals · Protocols
        </div>
      </div>
    </div>
  );
}

/* ── HUD Metric Pill (center strip) ── */
function HUDMetric({ label, value, unit, color, pulse }: {
  label: string; value: string | number; unit?: string; color: string; pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {pulse && (
        <div className="relative w-1.5 h-1.5">
          <div className="absolute inset-0 rounded-full" style={{ background: color, opacity: 0.3, animation: 'statusDotPulse 2s ease-in-out infinite' }} />
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
        </div>
      )}
      <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: 'rgba(138,126,114,0.4)' }}>{label}</span>
      <span className="typo-data text-[11px]" style={{ color, filter: `drop-shadow(0 0 4px ${color}44)` }}>{value}</span>
      {unit && <span className="text-[7px] font-mono" style={{ color: `${color}88` }}>{unit}</span>}
    </div>
  );
}

/* ── Cmd+K Trigger Button ── */
function CmdKButton({ ghostMode, onClick }: { ghostMode: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all duration-200 hover:scale-[1.02]"
      style={{
        background: ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(232,151,108,0.04)',
        border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(232,151,108,0.08)'}`,
      }}
      title="Command Bar (⌘K)"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.4 }}>
        <circle cx="5" cy="5" r="3.5" stroke={ghostMode ? '#a0a0a0' : '#E8976C'} strokeWidth="1.2" />
        <path d="M7.5 7.5L10 10" stroke={ghostMode ? '#a0a0a0' : '#E8976C'} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span className="text-[8px] font-mono tracking-wider hidden sm:inline" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(138,126,114,0.4)' }}>
        ⌘K
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════ */

export default function TopHeader({ mounted, ghostMode, activeView, onLogoClick, onOrbOpen, onToggleGhost, onOpenBriefing, onOpenCommandBar }: {
  mounted: boolean;
  ghostMode: boolean;
  activeView: ViewId;
  onLogoClick: () => void;
  onOrbOpen: () => void;
  onToggleGhost: () => void;
  onOpenBriefing: () => void;
  onOpenCommandBar?: () => void;
}) {
  const [hoverLogo, setHoverLogo] = useState(false);

  // Session ID for performance data
  const sessionId = typeof window !== 'undefined' ? getTwinSessionId() : '';
  const perf = usePerformanceScore(sessionId);

  // Pull latest logged vitals from QuickLog for real-time HUD metrics
  const latestVitals = useQuery(api.quickLog.getLatestVitals, sessionId ? { sessionId } : 'skip');

  // Use real logged vitals when available, fall back to simulated
  const displayHr = latestVitals?.hr?.value ?? perf.hr;
  const displaySpo2 = latestVitals?.spo2?.value ?? perf.spo2;
  const displayRecovery = perf.recovery;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const recoveryColor = useMemo(() => {
    if (ghostMode) return 'rgba(160,160,160,0.6)';
    if (displayRecovery >= 75) return '#7CB68E';
    if (displayRecovery >= 50) return '#C4A46C';
    return '#D4847A';
  }, [displayRecovery, ghostMode]);

  const viewLabels: Partial<Record<ViewId, string>> = {
    dashboard: "Command Center", journal: "Journal", vitals: "Vitals", blueprint: "Blueprint",
    activity: "Activity", progress: "Progress", community: "Community",
    biovault: "Bio-Vault", nutrition: "Nutrition", dna: "DNA Insights",
    protocols: "Protocols", biometrics: "Biometrics", milestones: "Milestones",
    trainer: "Trainer", briefing: "Briefing Room",
  };

  return (
    <nav
      className={`relative z-50 flex items-center justify-between px-3 sm:px-4 py-2 transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3"}`}
      style={{
        background: 'rgba(15,14,13,0.8)',
        backdropFilter: 'blur(24px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
        borderBottom: `1px solid ${ghostMode ? 'rgba(160,160,160,0.05)' : 'rgba(232,151,108,0.06)'}`,
        boxShadow: '0 1px 20px rgba(0,0,0,0.3)',
      }}
    >
      {/* ── Left: Logo + Breadcrumb ── */}
      <div
        className="flex items-center gap-2 transition-opacity duration-300"
        style={{ opacity: hoverLogo ? 1 : 0.85 }}
        onMouseEnter={() => setHoverLogo(true)}
        onMouseLeave={() => setHoverLogo(false)}
      >
        <button
          type="button"
          onClick={onLogoClick}
          className="flex items-center gap-2 cursor-pointer bg-transparent border-none outline-none p-0"
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center border transition-all duration-300"
            style={{
              background: hoverLogo
                ? (ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(232,151,108,0.1)')
                : (ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(232,151,108,0.04)'),
              borderColor: ghostMode ? 'rgba(160,160,160,0.12)' : 'rgba(232,151,108,0.12)',
              boxShadow: hoverLogo && !ghostMode ? '0 0 12px rgba(232,151,108,0.1)' : 'none',
            }}
          >
            <span className="text-[11px] font-bold" style={{
              color: ghostMode ? 'rgba(160,160,160,0.5)' : '#E8976C',
              textShadow: ghostMode ? 'none' : '0 0 8px rgba(232,151,108,0.4)',
            }}>
              V
            </span>
          </div>
        </button>

        {/* Breadcrumb */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1.5"
          >
            <span className="text-[9px] font-mono" style={{ color: ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(232,151,108,0.2)' }}>/</span>
            <span className="typo-header text-[9px]" style={{ color: ghostMode ? 'rgba(160,160,160,0.45)' : 'rgba(232,151,108,0.55)' }}>
              {viewLabels[activeView] || activeView}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Center: HUD Telemetry Strip (desktop) ── */}
      <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center gap-3 px-3 py-1 rounded-full"
        style={{
          background: ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(232,151,108,0.02)',
          border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.05)' : 'rgba(232,151,108,0.05)'}`,
        }}
      >
        <HUDMetric label="HR" value={displayHr} unit="bpm" color={ghostMode ? 'rgba(160,160,160,0.6)' : '#7CB68E'} pulse />
        <div className="w-px h-3" style={{ background: ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(232,151,108,0.08)' }} />
        <HUDMetric label="REC" value={`${displayRecovery}%`} color={recoveryColor} />
        <div className="w-px h-3" style={{ background: ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(232,151,108,0.08)' }} />
        <HUDMetric label="SpO₂" value={displaySpo2} unit="%" color={ghostMode ? 'rgba(160,160,160,0.6)' : '#6BA3BE'} />
      </div>

      {/* Mobile center: time + date */}
      <div className="sm:hidden absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        <span className="typo-data text-[11px]" style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(232,151,108,0.4)' }}>
          {timeStr}
        </span>
        <span className="text-[8px] font-mono" style={{ color: ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(232,151,108,0.15)' }}>·</span>
        <span className="text-[9px] font-mono" style={{ color: ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(138,126,114,0.3)' }}>
          {dateStr}
        </span>
      </div>

      {/* ── Right: Elite Score + Cmd+K + Status + Controls ── */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Daily Stack Widget — supplement checklist */}
        <DailyStackHeaderWidget sessionId={sessionId} ghostMode={ghostMode} />

        {/* Elite Score Ring — always visible */}
        <EliteScoreRing score={perf.eliteScore} ghostMode={ghostMode} />

        {/* Cmd+K trigger */}
        {onOpenCommandBar && (
          <CmdKButton ghostMode={ghostMode} onClick={onOpenCommandBar} />
        )}

        {/* System Status */}
        <SystemStatus ghostMode={ghostMode} />

        {/* Divider */}
        <div className="w-px h-4 mx-0.5" style={{ background: ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(42,38,34,0.6)' }} />

        {/* Ghost mode toggle */}
        <button
          onClick={onToggleGhost}
          className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300"
          style={{
            background: ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(232,151,108,0.06)',
            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(232,151,108,0.1)'}`,
          }}
          title={ghostMode ? "Exit Ghost Mode" : "Enter Ghost Mode"}
        >
          <span className="text-[9px]">{ghostMode ? "\uD83D\uDC7B" : "\uD83D\uDC41"}</span>
        </button>

        {/* Briefing / Profile button */}
        <button
          type="button"
          onClick={onOpenBriefing}
          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-300"
          style={{
            background: ghostMode
              ? 'linear-gradient(135deg, rgba(160,160,160,0.1), rgba(160,160,160,0.05))'
              : 'linear-gradient(135deg, rgba(232,151,108,0.12), rgba(124,182,142,0.08))',
            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(232,151,108,0.15)'}`,
            color: ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(232,224,216,0.7)',
            boxShadow: ghostMode ? 'none' : '0 0 8px rgba(232,151,108,0.06)',
          }}
        >
          V
        </button>
      </div>
    </nav>
  );
}
