import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useGhostMode } from "@/components/Presence/usePresenceState";
import { MilestoneGallery } from "./MilestoneGallery";
import { VisualProgressCard } from "@/components/VisualProgressCard";

/* ── Generate 30-day historical data ── */
function generate30DayData(base: number, variance: number, trend: number = 0): number[] {
  const data: number[] = [];
  let val = base - trend * 15;
  for (let i = 0; i < 30; i++) {
    val += (Math.random() - 0.45) * variance + trend;
    val = Math.max(base - variance * 3, Math.min(base + variance * 3, val));
    data.push(Math.round(val * 10) / 10);
  }
  return data;
}

/* ── Status helpers ── */
function getProgressStatus(data: number[]): { label: string; color: string; bg: string; border: string; emoji: string } {
  if (data.length < 7) return { label: "Getting started", color: "#FFD60A", bg: "rgba(255,214,10,0.08)", border: "rgba(255,214,10,0.2)", emoji: "🔄" };
  const recent = data.slice(-7);
  const earlier = data.slice(-14, -7);
  const avgRecent = recent.reduce((s, v) => s + v, 0) / recent.length;
  const avgEarlier = earlier.length > 0 ? earlier.reduce((s, v) => s + v, 0) / earlier.length : avgRecent;
  const delta = avgRecent - avgEarlier;
  const pctChange = avgEarlier > 0 ? (delta / avgEarlier) * 100 : 0;

  if (pctChange > 3) return { label: "Good", color: "#30D158", bg: "rgba(48,209,88,0.08)", border: "rgba(48,209,88,0.2)", emoji: "✅" };
  if (pctChange < -3) return { label: "Needs attention", color: "#FF453A", bg: "rgba(255,69,58,0.08)", border: "rgba(255,69,58,0.2)", emoji: "⚠️" };
  return { label: "Steady", color: "#FFD60A", bg: "rgba(255,214,10,0.08)", border: "rgba(255,214,10,0.2)", emoji: "➡️" };
}

function getExplanationText(status: string, data: number[]): string {
  const recent = data.slice(-7);
  const avgRecent = Math.round(recent.reduce((s, v) => s + v, 0) / recent.length);

  if (status === "Good") {
    return `Your progress is trending upward over the last 7 days, averaging around ${avgRecent}. This means your habits are working — keep doing what you're doing. Your body is responding well to your current routine.`;
  }
  if (status === "Needs attention") {
    return `Your progress has dipped slightly over the past week, averaging around ${avgRecent}. This could be due to sleep, stress, or missed routines. Don't worry — small adjustments like better rest or lighter activity can turn this around quickly.`;
  }
  return `Your progress is holding steady at around ${avgRecent}. You're maintaining a solid baseline, which is a sign of consistency. To push higher, try adding one new healthy habit this week.`;
}

/* ── Simple Progress Trend Line ── */
function ProgressTrendLine({ data, ghostMode }: { data: number[]; ghostMode: boolean }) {
  const w = 340;
  const h = 120;
  const padL = 32;
  const padR = 12;
  const padT = 12;
  const padB = 24;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const min = Math.min(...data) - 3;
  const max = Math.max(...data) + 3;

  const pts = data.map((v, i) => ({
    x: padL + (i / (data.length - 1)) * chartW,
    y: padT + chartH - ((v - min) / (max - min)) * chartH,
  }));

  function smoothPath(points: { x: number; y: number }[]): string {
    return points.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x},${pt.y}`;
      const prev = points[i - 1];
      const cx1 = prev.x + (pt.x - prev.x) * 0.35;
      const cx2 = pt.x - (pt.x - prev.x) * 0.35;
      return `${acc} C ${cx1},${prev.y} ${cx2},${pt.y} ${pt.x},${pt.y}`;
    }, "");
  }

  const path = smoothPath(pts);
  const status = getProgressStatus(data);
  const lineColor = ghostMode ? "rgba(160,160,160,0.5)" : status.color;
  const gridColor = ghostMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)";
  const labelColor = ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.25)";

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => padT + chartH * (1 - pct));

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="progress-trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridLines.map((y, i) => (
        <line key={i} x1={padL} y1={y} x2={w - padR} y2={y} stroke={gridColor} strokeWidth="0.5" />
      ))}

      {[0, 7, 14, 21, 29].map(day => {
        const x = padL + (day / 29) * chartW;
        return (
          <text key={day} x={x} y={h - 4} textAnchor="middle" fill={labelColor} fontSize="9" fontFamily="monospace">
            D{day + 1}
          </text>
        );
      })}

      <path d={`${path} L ${pts[pts.length - 1].x},${padT + chartH} L ${pts[0].x},${padT + chartH} Z`} fill="url(#progress-trend-fill)" />
      <path d={path} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" />

      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="4" fill={lineColor}>
        <animate attributeName="opacity" values="1;0.5;1" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ── Correlation Chart SVG (Deep Dive) ── */
function CorrelationChart({
  adherenceData,
  recoveryData,
  ghostMode,
}: {
  adherenceData: number[];
  recoveryData: number[];
  ghostMode: boolean;
}) {
  const w = 320;
  const h = 160;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const adhMin = Math.min(...adherenceData) - 5;
  const adhMax = Math.max(...adherenceData) + 5;
  const recMin = Math.min(...recoveryData) - 5;
  const recMax = Math.max(...recoveryData) + 5;

  const adhPts = adherenceData.map((v, i) => ({
    x: padL + (i / (adherenceData.length - 1)) * chartW,
    y: padT + chartH - ((v - adhMin) / (adhMax - adhMin)) * chartH,
  }));

  const recPts = recoveryData.map((v, i) => ({
    x: padL + (i / (recoveryData.length - 1)) * chartW,
    y: padT + chartH - ((v - recMin) / (recMax - recMin)) * chartH,
  }));

  function smoothPath(pts: { x: number; y: number }[]): string {
    return pts.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x},${pt.y}`;
      const prev = pts[i - 1];
      const cx1 = prev.x + (pt.x - prev.x) * 0.35;
      const cx2 = pt.x - (pt.x - prev.x) * 0.35;
      return `${acc} C ${cx1},${prev.y} ${cx2},${pt.y} ${pt.x},${pt.y}`;
    }, "");
  }

  const adhPath = smoothPath(adhPts);
  const recPath = smoothPath(recPts);

  const adhColor = ghostMode ? "rgba(160,160,160,0.5)" : "#30D158";
  const recColor = ghostMode ? "rgba(120,120,120,0.5)" : "#FFD60A";
  const gridColor = ghostMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)";
  const labelColor = ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.25)";

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => padT + chartH * (1 - pct));

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="adh-fill-dd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={adhColor} stopOpacity="0.15" />
          <stop offset="100%" stopColor={adhColor} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rec-fill-dd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={recColor} stopOpacity="0.12" />
          <stop offset="100%" stopColor={recColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridLines.map((y, i) => (
        <line key={i} x1={padL} y1={y} x2={w - padR} y2={y} stroke={gridColor} strokeWidth="0.5" />
      ))}

      {[0, 7, 14, 21, 29].map(day => {
        const x = padL + (day / 29) * chartW;
        return (
          <text key={day} x={x} y={h - 6} textAnchor="middle" fill={labelColor} fontSize="9" fontFamily="monospace">
            D{day + 1}
          </text>
        );
      })}

      <text x={padL - 4} y={padT + 4} textAnchor="end" fill={labelColor} fontSize="8" fontFamily="monospace">100</text>
      <text x={padL - 4} y={padT + chartH} textAnchor="end" fill={labelColor} fontSize="8" fontFamily="monospace">50</text>

      <path d={`${adhPath} L ${adhPts[adhPts.length - 1].x},${padT + chartH} L ${adhPts[0].x},${padT + chartH} Z`} fill="url(#adh-fill-dd)" />
      <path d={adhPath} fill="none" stroke={adhColor} strokeWidth="2" strokeLinecap="round" />

      <path d={`${recPath} L ${recPts[recPts.length - 1].x},${padT + chartH} L ${recPts[0].x},${padT + chartH} Z`} fill="url(#rec-fill-dd)" />
      <path d={recPath} fill="none" stroke={recColor} strokeWidth="2" strokeLinecap="round" strokeDasharray="4 2" />

      <circle cx={adhPts[adhPts.length - 1].x} cy={adhPts[adhPts.length - 1].y} r="3.5" fill={adhColor} />
      <circle cx={recPts[recPts.length - 1].x} cy={recPts[recPts.length - 1].y} r="3.5" fill={recColor} />
    </svg>
  );
}

/* ── Bio-Age Ring ── */
function BioAgeRing({
  chronologicalAge,
  biologicalAge,
  ghostMode,
}: {
  chronologicalAge: number;
  biologicalAge: number;
  ghostMode: boolean;
}) {
  const diff = chronologicalAge - biologicalAge;
  const isYounger = diff > 0;
  const radius = 52;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const maxAge = 100;
  const bioProgress = (biologicalAge / maxAge) * circumference;
  const chronProgress = (chronologicalAge / maxAge) * circumference;

  const bioColor = ghostMode
    ? "rgba(160,160,160,0.5)"
    : isYounger ? "#30D158" : "#FF453A";
  const chronColor = ghostMode ? "rgba(160,160,160,0.15)" : "rgba(255,255,255,0.08)";

  return (
    <div className="relative flex items-center justify-center">
      <svg width={140} height={140} viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke={chronColor} strokeWidth={stroke} strokeLinecap="round" transform="rotate(-90 70 70)" />
        <motion.circle cx="70" cy="70" r={radius} fill="none" stroke={ghostMode ? "rgba(160,160,160,0.12)" : "rgba(255,255,255,0.12)"} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference - chronProgress }} transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.2 }} transform="rotate(-90 70 70)" />
        <motion.circle cx="70" cy="70" r={radius} fill="none" stroke={bioColor} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: circumference - bioProgress }} transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: 0.4 }} transform="rotate(-90 70 70)" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.6 }}
          className="text-3xl font-bold tabular-nums" style={{ color: bioColor }}>
          {biologicalAge}
        </motion.span>
        <span className="text-[10px] font-mono uppercase tracking-wider mt-0.5" style={{ color: ghostMode ? "rgba(160,160,160,0.35)" : "rgba(255,255,255,0.35)" }}>Bio-Age</span>
      </div>
    </div>
  );
}

/* ── Consistency Tracker ── */
function ConsistencyTracker({ scores, ghostMode }: { scores: number[]; ghostMode: boolean }) {
  // Take last 7 days from the scores array
  const last7 = scores.slice(-7);
  const daysOnTrack = last7.filter(s => s > 70).length;

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  // Figure out what day of week "today" is to label correctly
  const today = new Date().getDay(); // 0=Sun
  const orderedLabels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayIdx = (today - i + 7) % 7;
    // Map 0=Sun,1=Mon... to labels
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    orderedLabels.push(labels[dayIdx]);
  }

  function getCircleStyle(score: number) {
    if (ghostMode) {
      return {
        bg: score > 70 ? 'rgba(160,160,160,0.25)' : score >= 50 ? 'rgba(160,160,160,0.15)' : 'rgba(160,160,160,0.06)',
        border: score > 70 ? 'rgba(160,160,160,0.4)' : score >= 50 ? 'rgba(160,160,160,0.25)' : 'rgba(160,160,160,0.1)',
        inner: score > 70 ? 'rgba(160,160,160,0.5)' : score >= 50 ? 'rgba(160,160,160,0.3)' : 'transparent',
        glow: 'none',
      };
    }
    if (score > 70) return {
      bg: 'rgba(48,209,88,0.15)',
      border: 'rgba(48,209,88,0.5)',
      inner: '#30D158',
      glow: '0 0 12px rgba(48,209,88,0.3)',
    };
    if (score >= 50) return {
      bg: 'rgba(255,214,10,0.12)',
      border: 'rgba(255,214,10,0.4)',
      inner: '#FFD60A',
      glow: '0 0 8px rgba(255,214,10,0.15)',
    };
    return {
      bg: 'rgba(255,255,255,0.04)',
      border: 'rgba(255,255,255,0.08)',
      inner: 'transparent',
      glow: 'none',
    };
  }

  const textPrimary = ghostMode ? 'rgba(220,220,220,0.7)' : 'rgba(255,255,255,0.95)';
  const textSecondary = ghostMode ? 'rgba(180,180,180,0.5)' : 'rgba(255,255,255,0.5)';
  const accentColor = ghostMode ? 'rgba(160,160,160,0.5)' : '#30D158';
  const cardBg = ghostMode ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)';
  const cardBorder = ghostMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.08)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
      className="mx-4 mb-4 rounded-2xl border p-5 relative overflow-hidden"
      style={{ background: cardBg, borderColor: cardBorder }}
    >
      {/* Top accent bar */}
      {!ghostMode && (
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #30D158, #FFD60A)', opacity: 0.6 }} />
      )}

      {/* Header */}
      <div className="text-center mb-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="text-[13px] font-bold uppercase tracking-widest mb-2"
          style={{ color: accentColor }}
        >
          7-Day Consistency
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="text-[28px] sm:text-[34px] font-extrabold tracking-tight leading-none"
          style={{ color: textPrimary }}
        >
          {daysOnTrack} Day{daysOnTrack !== 1 ? 's' : ''} on Track!
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          className="text-[14px] mt-1.5"
          style={{ color: textSecondary }}
        >
          {daysOnTrack >= 6 ? 'Incredible week — you\'re unstoppable' : daysOnTrack >= 4 ? 'Solid consistency — keep pushing' : daysOnTrack >= 2 ? 'Building momentum — every day counts' : 'A new week, a fresh start'}
        </motion.p>
      </div>

      {/* 7 Circles */}
      <div className="flex items-center justify-center gap-3 sm:gap-4">
        {last7.map((score, i) => {
          const style = getCircleStyle(score);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.3 + i * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
              className="flex flex-col items-center gap-1.5"
            >
              <div
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  background: style.bg,
                  border: `2px solid ${style.border}`,
                  boxShadow: style.glow,
                }}
              >
                {score > 70 && (
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full" style={{ background: style.inner, opacity: 0.9 }} />
                )}
                {score >= 50 && score <= 70 && (
                  <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full" style={{ background: style.inner, opacity: 0.6 }} />
                )}
              </div>
              <span
                className="text-[10px] sm:text-[11px] font-bold font-mono"
                style={{ color: score > 70 ? accentColor : textSecondary }}
              >
                {orderedLabels[i]}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-5 mt-4 pt-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: ghostMode ? 'rgba(160,160,160,0.4)' : '#30D158' }} />
          <span className="text-[10px] font-mono" style={{ color: textSecondary }}>Above 70</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: ghostMode ? 'rgba(160,160,160,0.25)' : '#FFD60A' }} />
          <span className="text-[10px] font-mono" style={{ color: textSecondary }}>50–70</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(255,255,255,0.08)', border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(255,255,255,0.12)'}` }} />
          <span className="text-[10px] font-mono" style={{ color: textSecondary }}>No data</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Stagger animations ── */
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] } },
};

/* ── Marker Card Icon SVGs ── */
function MarkerIcon({ type, color, ghostMode }: { type: string; color: string; ghostMode: boolean }) {
  const c = ghostMode ? "rgba(160,160,160,0.5)" : color;
  const bg = ghostMode ? "rgba(160,160,160,0.06)" : `${color}12`;
  const border = ghostMode ? "rgba(160,160,160,0.1)" : `${color}25`;

  const icons: Record<string, React.ReactNode> = {
    vitaminD: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="4" stroke={c} strokeWidth="1.5" />
        <path d="M10 2V5M10 15V18M2 10H5M15 10H18M4.2 4.2L6.3 6.3M13.7 13.7L15.8 15.8M15.8 4.2L13.7 6.3M6.3 13.7L4.2 15.8" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    testosterone: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="8" cy="12" r="5" stroke={c} strokeWidth="1.5" />
        <path d="M12 8L17 3M17 3H13M17 3V7" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    crp: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 14L7 8L11 11L17 4" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="17" cy="4" r="2" fill={c} fillOpacity="0.3" stroke={c} strokeWidth="1" />
      </svg>
    ),
    hba1c: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="6" width="14" height="8" rx="2" stroke={c} strokeWidth="1.5" />
        <path d="M7 6V4M13 6V4M3 10H17" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    ferritin: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2L10 18M6 6L10 2L14 6M6 14L10 18L14 14" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    mthfr: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M6 3C6 3 4 7 4 10C4 13 6 17 6 17" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 3C14 3 16 7 16 10C16 13 14 17 14 17" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M6 8H14M6 12H14" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    apoe4: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 2L10 18" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M5 5L10 10L15 5M5 15L10 10L15 15" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      {icons[type] || icons.crp}
    </div>
  );
}

/* ── Mini sparkline for marker trend ── */
function MarkerSparkline({ data, color, ghostMode }: { data: number[]; color: string; ghostMode: boolean }) {
  const w = 64;
  const h = 24;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: pad + (1 - (v - min) / range) * (h - pad * 2),
  }));

  const path = pts.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x},${pt.y}`;
    const prev = pts[i - 1];
    const cx = (prev.x + pt.x) / 2;
    return `${acc} C ${cx},${prev.y} ${cx},${pt.y} ${pt.x},${pt.y}`;
  }, "");

  const strokeColor = ghostMode ? "rgba(160,160,160,0.35)" : color;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.15" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${pts[pts.length - 1].x},${h} L ${pts[0].x},${h} Z`} fill={`url(#spark-${color.replace('#', '')})`} />
      <path d={path} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2" fill={strokeColor} />
    </svg>
  );
}

/* ── Delta Badge ── */
function DeltaBadge({
  baseline,
  latest,
  lowerIsBetter,
  ghostMode,
}: {
  baseline: number;
  latest: number;
  unit: string;
  lowerIsBetter: boolean;
  ghostMode: boolean;
}) {
  if (baseline === 0) return null;
  const diff = latest - baseline;
  const pct = Math.round((diff / baseline) * 100);
  const isImproved = lowerIsBetter ? diff < 0 : diff > 0;
  const isNeutral = pct === 0;

  const arrow = isNeutral ? "\u2192" : isImproved ? "\u2191" : "\u2193";
  const color = isNeutral
    ? (ghostMode ? "rgba(160,160,160,0.4)" : "rgba(255,255,255,0.4)")
    : isImproved
      ? (ghostMode ? "rgba(160,160,160,0.5)" : "#30D158")
      : (ghostMode ? "rgba(160,160,160,0.5)" : "#FF453A");
  const bg = isNeutral
    ? (ghostMode ? "rgba(160,160,160,0.04)" : "rgba(255,255,255,0.04)")
    : isImproved
      ? (ghostMode ? "rgba(160,160,160,0.06)" : "rgba(48,209,88,0.08)")
      : (ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,69,58,0.08)");
  const borderColor = isNeutral
    ? (ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,255,255,0.06)")
    : isImproved
      ? (ghostMode ? "rgba(160,160,160,0.1)" : "rgba(48,209,88,0.15)")
      : (ghostMode ? "rgba(160,160,160,0.1)" : "rgba(255,69,58,0.15)");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="flex items-center gap-1 px-2.5 py-1 rounded-full"
      style={{ background: bg, border: `1px solid ${borderColor}` }}
    >
      <span className="text-[11px] font-bold" style={{ color }}>{arrow}</span>
      <span className="text-[11px] font-bold font-mono tabular-nums" style={{ color }}>
        {Math.abs(pct)}%
      </span>
    </motion.div>
  );
}

/* ── Marker Card definition ── */
interface MarkerDef {
  id: string;
  label: string;
  iconType: string;
  color: string;
  unit: string;
  optimalRange: string;
  lowerIsBetter: boolean;
  baselineKey: string;
  latestOffset: number;
  fallbackBaseline: number;
}

const MARKERS: MarkerDef[] = [
  { id: "vitaminD", label: "Vitamin D", iconType: "vitaminD", color: "#FFD700", unit: "ng/mL", optimalRange: "40\u201360", lowerIsBetter: false, baselineKey: "vitaminD", latestOffset: 8, fallbackBaseline: 28 },
  { id: "testTotal", label: "Testosterone (Total)", iconType: "testosterone", color: "#30D158", unit: "ng/dL", optimalRange: "500\u2013900", lowerIsBetter: false, baselineKey: "testosteroneTotal", latestOffset: 65, fallbackBaseline: 420 },
  { id: "testFree", label: "Testosterone (Free)", iconType: "testosterone", color: "#30D158", unit: "pg/mL", optimalRange: "15\u201325", lowerIsBetter: false, baselineKey: "testosteroneFree", latestOffset: 3.2, fallbackBaseline: 12 },
  { id: "crp", label: "CRP (Inflammation)", iconType: "crp", color: "#FF453A", unit: "mg/L", optimalRange: "< 1.0", lowerIsBetter: true, baselineKey: "crp", latestOffset: -0.4, fallbackBaseline: 1.8 },
  { id: "hba1c", label: "HbA1c (Glucose)", iconType: "hba1c", color: "#FFD60A", unit: "%", optimalRange: "< 5.4", lowerIsBetter: true, baselineKey: "hba1c", latestOffset: -0.2, fallbackBaseline: 5.6 },
  { id: "ferritin", label: "Ferritin (Iron)", iconType: "ferritin", color: "#FF9F0A", unit: "ng/mL", optimalRange: "50\u2013200", lowerIsBetter: false, baselineKey: "ferritin", latestOffset: 18, fallbackBaseline: 35 },
];

/* ── Deep Dive Accordion Section ── */
function DeepDiveSection({
  title,
  emoji,
  isOpen,
  onToggle,
  ghostMode,
  children,
}: {
  title: string;
  emoji: string;
  isOpen: boolean;
  onToggle: () => void;
  ghostMode: boolean;
  children: React.ReactNode;
}) {
  const textPrimary = ghostMode ? "rgba(220,220,220,0.7)" : "rgba(255,255,255,0.92)";
  const textTertiary = ghostMode ? "rgba(160,160,160,0.35)" : "rgba(255,255,255,0.3)";
  const cardBg = ghostMode ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.04)";
  const cardBorder = ghostMode ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.06)";

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: cardBg, borderColor: cardBorder }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 transition-colors duration-200"
        style={{ background: isOpen ? (ghostMode ? "rgba(160,160,160,0.04)" : "rgba(255,255,255,0.02)") : "transparent" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm">{emoji}</span>
          <span className="text-[13px] font-semibold" style={{ color: textPrimary }}>{title}</span>
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[12px]"
          style={{ color: textTertiary }}
        >
          ▼
        </motion.span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Main ProgressView
   Default: Simple trend + status indicator + Explain button
   Deep Dive: Accordion sections for complex data
   ══════════════════════════════════════════════ */
export function ProgressView({ mounted }: { mounted?: boolean }) {
  const ghostMode = useGhostMode();
  const [showExplain, setShowExplain] = useState(false);
  const [deepDiveOpen, setDeepDiveOpen] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setDeepDiveOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };

  /* Pull Bio-Vault data for baselines */
  const sessionId = useMemo(() => {
    if (typeof window !== "undefined") {
      let id = window.sessionStorage.getItem("vive-session-id");
      if (!id) {
        id = crypto.randomUUID();
        window.sessionStorage.setItem("vive-session-id", id);
      }
      return id;
    }
    return "default";
  }, []);

  const bioVault = useQuery(api.queries.getBioVaultBySession, { sessionId });
  const foodLogs = useQuery(api.queries.listFoodLogs);
  const activityLogs = useQuery(api.queries.listActivityLogs);
  const hasProtocolActivity = (foodLogs && foodLogs.length > 0) || (activityLogs && activityLogs.length > 0);

  const textPrimary = ghostMode ? "rgba(220,220,220,0.7)" : "rgba(255,255,255,0.92)";
  const textSecondary = ghostMode ? "rgba(180,180,180,0.5)" : "rgba(255,255,255,0.5)";
  const textTertiary = ghostMode ? "rgba(160,160,160,0.35)" : "rgba(255,255,255,0.3)";
  const cardBg = ghostMode ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.04)";
  const cardBorder = ghostMode ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.06)";

  /* 30-day trend data */
  const progressData = useMemo(() => generate30DayData(72, 8, 0.4), []);
  const adherenceData = useMemo(() => generate30DayData(72, 8, 0.4), []);
  const recoveryData = useMemo(() => generate30DayData(78, 6, 0.3), []);

  const status = useMemo(() => getProgressStatus(progressData), [progressData]);
  const explanationText = useMemo(() => getExplanationText(status.label, progressData), [status, progressData]);

  const correlation = useMemo(() => {
    const n = adherenceData.length;
    const meanA = adherenceData.reduce((s, v) => s + v, 0) / n;
    const meanR = recoveryData.reduce((s, v) => s + v, 0) / n;
    let num = 0, denA = 0, denR = 0;
    for (let i = 0; i < n; i++) {
      const da = adherenceData[i] - meanA;
      const dr = recoveryData[i] - meanR;
      num += da * dr;
      denA += da * da;
      denR += dr * dr;
    }
    const den = Math.sqrt(denA * denR);
    return den === 0 ? 0 : Math.round((num / den) * 100) / 100;
  }, [adherenceData, recoveryData]);

  const chronologicalAge = 32;
  const rhr = 62;
  const hrv = 48;
  const vitaminD = 38;
  const inflammation = 0.8;

  const bioAge = useMemo(() => {
    let age = chronologicalAge;
    if (rhr < 60) age -= 2; else if (rhr < 70) age -= 1; else if (rhr > 75) age += 2;
    if (hrv > 50) age -= 2; else if (hrv >= 40) age -= 1; else if (hrv < 30) age += 3;
    if (vitaminD >= 40 && vitaminD <= 60) age -= 1; else if (vitaminD < 30) age += 2;
    if (inflammation < 1) age -= 1; else if (inflammation > 3) age += 3;
    return Math.max(18, Math.round(age));
  }, []);

  const bioAgeDiff = chronologicalAge - bioAge;

  const factors = [
    { label: "Resting Heart Rate", value: `${rhr} BPM`, impact: rhr < 70 ? "positive" : "negative", detail: rhr < 60 ? "-2 years" : rhr < 70 ? "-1 year" : "+2 years" },
    { label: "Heart Rate Variability", value: `${hrv} ms`, impact: hrv >= 40 ? "positive" : "negative", detail: hrv > 50 ? "-2 years" : hrv >= 40 ? "-1 year" : "+3 years" },
    { label: "Vitamin D", value: `${vitaminD} ng/mL`, impact: vitaminD >= 40 ? "positive" : "neutral", detail: vitaminD >= 40 ? "-1 year" : vitaminD < 30 ? "+2 years" : "0 years" },
    { label: "Inflammation (CRP)", value: `${inflammation} mg/L`, impact: inflammation < 1 ? "positive" : "negative", detail: inflammation < 1 ? "-1 year" : inflammation > 3 ? "+3 years" : "0 years" },
  ];

  /* Build marker data from Bio-Vault */
  const markerData = useMemo(() => {
    return MARKERS.map(m => {
      const vaultVal = bioVault ? (bioVault as Record<string, unknown>)[m.baselineKey] : null;
      const baseline = typeof vaultVal === "number" ? vaultVal : m.fallbackBaseline;
      const latest = Math.round((baseline + m.latestOffset) * 10) / 10;
      const hasVaultData = typeof vaultVal === "number";
      const trendData: number[] = [];
      for (let i = 0; i < 8; i++) {
        const progress = i / 7;
        const noise = (Math.random() - 0.5) * Math.abs(m.latestOffset) * 0.3;
        trendData.push(Math.round((baseline + m.latestOffset * progress + noise) * 10) / 10);
      }
      return { ...m, baseline, latest, hasVaultData, trendData };
    });
  }, [bioVault]);

  const markersImproved = markerData.filter(m => {
    const diff = m.latest - m.baseline;
    return m.lowerIsBetter ? diff < 0 : diff > 0;
  }).length;

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col min-h-0 pb-16">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="px-4 pt-1 pb-2">
        <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight leading-none" style={{ color: textPrimary }}>Your Progress</h1>
        <p className="text-[13px] sm:text-[15px] mt-0.5 font-normal" style={{ color: textSecondary }}>How you're doing over the last 30 days</p>
      </motion.div>

      {/* ═══ CONSISTENCY TRACKER — Most Prominent Element ═══ */}
      <ConsistencyTracker scores={progressData} ghostMode={ghostMode} />

      {/* Visual Progress Card */}
      <div className="px-4 mb-3">
        <VisualProgressCard />
      </div>

      {/* ═══ DEFAULT VIEW: Simple Trend + Status ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="mx-4 mb-3 rounded-2xl border p-4 relative overflow-hidden"
        style={{ background: cardBg, borderColor: cardBorder }}
      >
        {/* Status indicator bar */}
        {!ghostMode && (
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: status.color, opacity: 0.5 }} />
        )}

        {/* Status badge + label */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base">{status.emoji}</span>
            <span className="text-[18px] font-bold" style={{ color: textPrimary }}>Your Progress</span>
          </div>
          <div
            className="px-3 py-1.5 rounded-full"
            style={{ background: ghostMode ? "rgba(160,160,160,0.08)" : status.bg, border: `1px solid ${ghostMode ? "rgba(160,160,160,0.12)" : status.border}` }}
          >
            <span className="text-[13px] font-bold" style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : status.color }}>
              {status.label}
            </span>
          </div>
        </div>

        {/* Trend line */}
        <ProgressTrendLine data={progressData} ghostMode={ghostMode} />

        {/* Explain this to me button */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setShowExplain(!showExplain)}
            className="px-5 py-2.5 rounded-xl text-[14px] font-semibold transition-all duration-200"
            style={{
              background: ghostMode ? "rgba(160,160,160,0.08)" : "rgba(255,255,255,0.08)",
              border: `1px solid ${ghostMode ? "rgba(160,160,160,0.15)" : "rgba(255,255,255,0.12)"}`,
              color: ghostMode ? "rgba(160,160,160,0.6)" : "rgba(255,255,255,0.8)",
            }}
          >
            {showExplain ? "Got it" : "💡 Explain this to me"}
          </button>
        </div>

        {/* Explanation popover */}
        <AnimatePresence>
          {showExplain && (
            <motion.div
              initial={{ opacity: 0, y: -8, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -8, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div
                className="mt-3 p-4 rounded-xl"
                style={{
                  background: ghostMode ? "rgba(160,160,160,0.04)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${ghostMode ? "rgba(160,160,160,0.08)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <p className="text-[15px] leading-relaxed" style={{ color: ghostMode ? "rgba(180,180,180,0.6)" : "rgba(255,255,255,0.75)" }}>
                  {explanationText}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ═══ DEEP DIVE ACCORDION ═══ */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
        className="mx-4 mb-3"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: textTertiary }}>Deep Dive</span>
          <div className="flex-1 h-px" style={{ background: cardBorder }} />
        </div>

        <div className="flex flex-col gap-2">
          {/* Blood Markers */}
          <DeepDiveSection
            title="Blood Markers"
            emoji="🩸"
            isOpen={!!deepDiveOpen.markers}
            onToggle={() => toggleSection("markers")}
            ghostMode={ghostMode}
          >
            <div className="flex flex-col gap-3">
              {/* Summary */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-mono" style={{ color: textTertiary }}>
                  {bioVault ? "Personalized from Bio-Vault" : "Using reference baselines"}
                </span>
                <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-full" style={{
                  color: ghostMode ? "rgba(160,160,160,0.5)" : "#30D158",
                  background: ghostMode ? "rgba(160,160,160,0.06)" : "rgba(48,209,88,0.08)",
                  border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(48,209,88,0.15)"}`,
                }}>
                  {markersImproved}/{markerData.length} improved
                </span>
              </div>

              {/* Marker Cards */}
              {markerData.map((marker) => (
                <div
                  key={marker.id}
                  className="rounded-xl border p-3"
                  style={{
                    background: ghostMode ? "rgba(8,8,12,0.5)" : "rgba(8,8,12,0.65)",
                    borderColor: ghostMode ? "rgba(255,255,255,0.05)" : `${marker.color}15`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <MarkerIcon type={marker.iconType} color={marker.color} ghostMode={ghostMode} />
                      <div>
                        <span className="text-[13px] font-bold" style={{ color: textPrimary }}>{marker.label}</span>
                        <div className="text-[10px] font-mono" style={{ color: textTertiary }}>Optimal: {marker.optimalRange} {marker.unit}</div>
                      </div>
                    </div>
                    <DeltaBadge baseline={marker.baseline} latest={marker.latest} unit={marker.unit} lowerIsBetter={marker.lowerIsBetter} ghostMode={ghostMode} />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex flex-col items-center py-1.5 rounded-lg" style={{ background: ghostMode ? "rgba(160,160,160,0.03)" : "rgba(255,255,255,0.03)" }}>
                      <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: textTertiary }}>Baseline</span>
                      <span className="text-[18px] font-bold font-mono tabular-nums" style={{ color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(255,255,255,0.4)" }}>{marker.baseline}</span>
                    </div>
                    <MarkerSparkline data={marker.trendData} color={marker.color} ghostMode={ghostMode} />
                    <div className="flex-1 flex flex-col items-center py-1.5 rounded-lg" style={{ background: ghostMode ? "rgba(160,160,160,0.04)" : `${marker.color}06` }}>
                      <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: textTertiary }}>Latest</span>
                      <span className="text-[18px] font-bold font-mono tabular-nums" style={{ color: ghostMode ? "rgba(160,160,160,0.6)" : marker.color }}>{marker.latest}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DeepDiveSection>

          {/* Impact Chart */}
          <DeepDiveSection
            title="Adherence vs Recovery"
            emoji="📊"
            isOpen={!!deepDiveOpen.impact}
            onToggle={() => toggleSection("impact")}
            ghostMode={ghostMode}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px]" style={{ color: textTertiary }}>30-day correlation</span>
                <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-full" style={{
                  color: ghostMode ? "rgba(160,160,160,0.5)" : (correlation > 0.5 ? "#30D158" : correlation > 0.2 ? "#FFD60A" : "#FF453A"),
                  background: ghostMode ? "rgba(160,160,160,0.06)" : (correlation > 0.5 ? "rgba(48,209,88,0.08)" : correlation > 0.2 ? "rgba(255,214,10,0.08)" : "rgba(255,69,58,0.08)"),
                  border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : (correlation > 0.5 ? "rgba(48,209,88,0.15)" : correlation > 0.2 ? "rgba(255,214,10,0.15)" : "rgba(255,69,58,0.15)")}`,
                }}>
                  r = {correlation > 0 ? "+" : ""}{correlation}
                </span>
              </div>

              <CorrelationChart adherenceData={adherenceData} recoveryData={recoveryData} ghostMode={ghostMode} />

              <div className="flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 rounded-full" style={{ background: ghostMode ? "rgba(160,160,160,0.5)" : "#30D158" }} />
                  <span className="text-[10px] font-mono" style={{ color: textTertiary }}>Adherence %</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 rounded-full" style={{ background: ghostMode ? "rgba(160,160,160,0.4)" : "#FFD60A", opacity: 0.8 }} />
                  <span className="text-[10px] font-mono" style={{ color: textTertiary }}>Recovery Score</span>
                </div>
              </div>

              <div className="p-3 rounded-xl" style={{ background: ghostMode ? "rgba(160,160,160,0.03)" : "rgba(255,255,255,0.03)", border: `1px solid ${cardBorder}` }}>
                <p className="text-[13px] leading-relaxed" style={{ color: textSecondary }}>
                  {correlation > 0.5
                    ? "Strong link between your routine and recovery. Your habits are clearly working."
                    : correlation > 0.2
                      ? "There's a growing connection between your routine and recovery. Keep it up."
                      : "Still building enough data to see a clear pattern. Keep logging daily."}
                </p>
              </div>
            </div>
          </DeepDiveSection>

          {/* Bio-Age */}
          <DeepDiveSection
            title="Bio-Age Estimate"
            emoji="🧬"
            isOpen={!!deepDiveOpen.bioage}
            onToggle={() => toggleSection("bioage")}
            ghostMode={ghostMode}
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-4 py-2">
                <BioAgeRing chronologicalAge={chronologicalAge} biologicalAge={bioAge} ghostMode={ghostMode} />
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center">
                    <span className="text-[22px] font-bold tabular-nums" style={{ color: textSecondary }}>{chronologicalAge}</span>
                    <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: textTertiary }}>Actual</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[11px] font-bold px-3 py-1 rounded-full" style={{
                      background: bioAgeDiff > 0 ? (ghostMode ? "rgba(160,160,160,0.08)" : "rgba(48,209,88,0.1)") : (ghostMode ? "rgba(160,160,160,0.08)" : "rgba(255,69,58,0.1)"),
                      color: bioAgeDiff > 0 ? (ghostMode ? "rgba(160,160,160,0.5)" : "#30D158") : (ghostMode ? "rgba(160,160,160,0.5)" : "#FF453A"),
                      border: `1px solid ${bioAgeDiff > 0 ? (ghostMode ? "rgba(160,160,160,0.12)" : "rgba(48,209,88,0.2)") : (ghostMode ? "rgba(160,160,160,0.12)" : "rgba(255,69,58,0.2)")}`,
                    }}>
                      {bioAgeDiff > 0 ? `${bioAgeDiff} years younger` : bioAgeDiff < 0 ? `${Math.abs(bioAgeDiff)} years older` : "On track"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[22px] font-bold tabular-nums" style={{ color: bioAgeDiff > 0 ? (ghostMode ? "rgba(160,160,160,0.6)" : "#30D158") : (ghostMode ? "rgba(160,160,160,0.6)" : "#FF453A") }}>{bioAge}</span>
                    <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: textTertiary }}>Biological</span>
                  </div>
                </div>
              </div>

              {/* Factor breakdown */}
              <div className="rounded-xl border overflow-hidden" style={{ background: ghostMode ? "rgba(8,8,12,0.5)" : "rgba(8,8,12,0.65)", borderColor: cardBorder }}>
                <div className="px-3 py-2" style={{ borderBottom: `0.5px solid ${cardBorder}` }}>
                  <span className="text-[12px] font-bold" style={{ color: textPrimary }}>Contributing Factors</span>
                </div>
                {factors.map((f, i) => {
                  const impactColor = f.impact === "positive" ? (ghostMode ? "rgba(160,160,160,0.5)" : "#30D158") : f.impact === "negative" ? (ghostMode ? "rgba(160,160,160,0.5)" : "#FF453A") : textTertiary;
                  const impactBg = f.impact === "positive" ? (ghostMode ? "rgba(160,160,160,0.06)" : "rgba(48,209,88,0.08)") : f.impact === "negative" ? (ghostMode ? "rgba(160,160,160,0.06)" : "rgba(255,69,58,0.08)") : "rgba(255,255,255,0.03)";
                  return (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: i < factors.length - 1 ? `0.5px solid ${cardBorder}` : "none" }}>
                      <div className="flex flex-col">
                        <span className="text-[12px] font-medium" style={{ color: textPrimary }}>{f.label}</span>
                        <span className="text-[10px] mt-0.5" style={{ color: textTertiary }}>{f.value}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                        color: impactColor, background: impactBg,
                        border: `1px solid ${f.impact === "positive" ? (ghostMode ? "rgba(160,160,160,0.1)" : "rgba(48,209,88,0.15)") : f.impact === "negative" ? (ghostMode ? "rgba(160,160,160,0.1)" : "rgba(255,69,58,0.15)") : cardBorder}`,
                      }}>{f.detail}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </DeepDiveSection>

          {/* Milestones */}
          <DeepDiveSection
            title="Milestones"
            emoji="🏆"
            isOpen={!!deepDiveOpen.milestones}
            onToggle={() => toggleSection("milestones")}
            ghostMode={ghostMode}
          >
            <MilestoneGallery />
          </DeepDiveSection>
        </div>
      </motion.div>
    </div>
  );
}
