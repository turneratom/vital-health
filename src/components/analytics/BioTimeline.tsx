import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  detectAnomalies,
  isNegativeDeviation,
  isLowerBetter,
  formatDeviation,
  type AnomalyResult,
} from '../../utils/BioCalculations';

/* ══════════════════════════════════════════════════════════════════════
   BIO-TIMELINE — Vertical minimalist timeline proving "Doing X caused Y"
   
   Fetches joined protocolLogs + labResults via getBioTimelineData.
   Renders:
   • Protocol Streaks as layered background bands
   • Biomarker Points as foreground nodes
   • Correlation Glows connecting streaks to positive lab changes
   • Anomaly Detection layer — red warning pulses for 15%+ deviations
     with causal text summaries linking to skipped protocols
   ══════════════════════════════════════════════════════════════════════ */

const CATEGORY_COLORS: Record<string, { bg: string; text: string; glow: string; line: string }> = {
  supplement: { bg: 'rgba(34,211,238,0.08)', text: 'text-cyan-400', glow: 'rgba(34,211,238,0.4)', line: 'rgba(34,211,238,0.25)' },
  training: { bg: 'rgba(74,222,128,0.08)', text: 'text-green-400', glow: 'rgba(74,222,128,0.4)', line: 'rgba(74,222,128,0.25)' },
  recovery: { bg: 'rgba(129,140,248,0.08)', text: 'text-indigo-400', glow: 'rgba(129,140,248,0.4)', line: 'rgba(129,140,248,0.25)' },
  nutrition: { bg: 'rgba(251,191,36,0.08)', text: 'text-amber-400', glow: 'rgba(251,191,36,0.4)', line: 'rgba(251,191,36,0.25)' },
  biohacking: { bg: 'rgba(168,85,247,0.08)', text: 'text-purple-400', glow: 'rgba(168,85,247,0.4)', line: 'rgba(168,85,247,0.25)' },
};

const DEFAULT_COLOR = { bg: 'rgba(148,163,184,0.08)', text: 'text-slate-400', glow: 'rgba(148,163,184,0.4)', line: 'rgba(148,163,184,0.25)' };

/* ── Marker → Protocol causal map for anomaly explanations ── */
const MARKER_PROTOCOL_CAUSES: Record<string, { protocols: string[]; mechanism: string }> = {
  'HRV': { protocols: ['Sleep Protocol', 'Recovery', 'Cold Plunge', 'Magnesium', 'Digital Detox'], mechanism: 'autonomic nervous system recovery' },
  'RHR': { protocols: ['Sleep Protocol', 'Recovery', 'Cold Plunge', 'Cardio', 'Movement'], mechanism: 'cardiovascular adaptation' },
  'Vitamin D': { protocols: ['Vitamin D', 'D3', 'Sunlight Protocol', 'Cholecalciferol'], mechanism: 'UVB synthesis and supplementation' },
  'CRP': { protocols: ['Omega-3', 'Curcumin', 'Sleep Protocol', 'Cold Plunge', 'Anti-inflammatory'], mechanism: 'systemic inflammation modulation' },
  'hs-CRP': { protocols: ['Omega-3', 'Curcumin', 'Sleep Protocol', 'Cold Plunge', 'Anti-inflammatory'], mechanism: 'systemic inflammation modulation' },
  'HbA1c': { protocols: ['Berberine', 'Movement', 'Post-meal Walk', 'Blood Sugar', 'Chromium'], mechanism: 'glucose metabolism and insulin sensitivity' },
  'Testosterone': { protocols: ['Sleep Protocol', 'Ashwagandha', 'Tongkat Ali', 'Zinc', 'Strength Training'], mechanism: 'hormonal optimization' },
  'Ferritin': { protocols: ['Iron', 'Iron Bisglycinate', 'Vitamin C'], mechanism: 'iron metabolism and absorption' },
  'ApoB': { protocols: ['Omega-3', 'Fish Oil', 'Berberine', 'Statin'], mechanism: 'lipid particle management' },
  'Cortisol': { protocols: ['Sleep Protocol', 'Digital Detox', 'Ashwagandha', 'Meditation'], mechanism: 'HPA axis regulation' },
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateRange(start: number, end: number): string {
  return `${formatDate(start)} — ${formatDate(end)}`;
}

function daysAgo(ts: number): string {
  const d = Math.round((Date.now() - ts) / (24 * 60 * 60 * 1000));
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

function dayName(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'long' });
}

/* ── Anomaly explanation generator ── */
interface AnomalyExplanation {
  marker: string;
  anomaly: AnomalyResult;
  likelyCause: string;
  skippedProtocols: string[];
  isNegative: boolean;
}

function generateAnomalyExplanations(
  anomalies: Map<string, AnomalyResult[]>,
  streaks: { protocolName: string; category: string; startDate: number; endDate: number }[],
  protocolLogTimestamps: number[],
): AnomalyExplanation[] {
  const explanations: AnomalyExplanation[] = [];

  for (const [marker, markerAnomalies] of anomalies) {
    const causes = MARKER_PROTOCOL_CAUSES[marker];
    if (!causes) continue;

    for (const anomaly of markerAnomalies) {
      const isNeg = isNegativeDeviation(marker, anomaly.direction);
      
      // Find protocols that were active/inactive around the anomaly date
      const windowStart = anomaly.timestamp - 7 * 24 * 60 * 60 * 1000;
      const windowEnd = anomaly.timestamp;

      // Check which related protocols had gaps near this anomaly
      const skippedProtocols: string[] = [];
      for (const protocolName of causes.protocols) {
        const hadStreak = streaks.some(s =>
          s.protocolName.toLowerCase().includes(protocolName.toLowerCase()) &&
          s.endDate >= windowStart && s.startDate <= windowEnd
        );
        if (!hadStreak) {
          skippedProtocols.push(protocolName);
        }
      }

      // Check for general protocol activity drop near anomaly
      const recentLogs = protocolLogTimestamps.filter(t => t >= windowStart && t <= windowEnd);
      const priorLogs = protocolLogTimestamps.filter(t => t >= windowStart - 7 * 24 * 60 * 60 * 1000 && t < windowStart);
      const activityDrop = priorLogs.length > 0 && recentLogs.length < priorLogs.length * 0.5;

      let likelyCause: string;
      if (isNeg && skippedProtocols.length > 0) {
        const protocolList = skippedProtocols.slice(0, 2).join(' and ');
        likelyCause = `${isLowerBetter(marker) ? 'Elevated' : 'Lowered'} ${marker} correlated with skipped ${protocolList} on ${dayName(anomaly.timestamp)}`;
      } else if (isNeg && activityDrop) {
        likelyCause = `${isLowerBetter(marker) ? 'Elevated' : 'Lowered'} ${marker} detected — protocol adherence dropped ${Math.round((1 - recentLogs.length / Math.max(priorLogs.length, 1)) * 100)}% in the prior week`;
      } else if (!isNeg) {
        const activeProtocols = streaks
          .filter(s => s.endDate >= windowStart && s.startDate <= windowEnd)
          .map(s => s.protocolName)
          .slice(0, 2);
        likelyCause = activeProtocols.length > 0
          ? `${marker} improvement linked to consistent ${activeProtocols.join(' + ')} adherence`
          : `${marker} ${isLowerBetter(marker) ? 'decreased' : 'increased'} — positive deviation from baseline`;
      } else {
        likelyCause = `${marker} deviated ${formatDeviation(anomaly.deviationPct)} from moving average — review recent protocol changes`;
      }

      explanations.push({
        marker,
        anomaly,
        likelyCause,
        skippedProtocols: skippedProtocols.slice(0, 3),
        isNegative: isNeg,
      });
    }
  }

  // Sort by severity (critical first) then by timestamp (newest first)
  explanations.sort((a, b) => {
    if (a.anomaly.severity !== b.anomaly.severity) {
      return a.anomaly.severity === 'critical' ? -1 : 1;
    }
    return b.anomaly.timestamp - a.anomaly.timestamp;
  });

  return explanations;
}

interface BioTimelineProps {
  sessionId: string;
  className?: string;
  maxItems?: number;
}

export default function BioTimeline({ sessionId, className = '', maxItems = 20 }: BioTimelineProps) {
  const data = useQuery(api.queries.getBioTimelineData, { sessionId });
  const [hoveredCorrelation, setHoveredCorrelation] = useState<string | null>(null);
  const [hoveredAnomaly, setHoveredAnomaly] = useState<string | null>(null);
  const [expandedAnomaly, setExpandedAnomaly] = useState<string | null>(null);
  const [animatedIn, setAnimatedIn] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setAnimatedIn(true), 150);
    return () => clearTimeout(t);
  }, []);

  // ── Anomaly Detection: scan lab results for 15%+ deviations ──
  const { anomalyMap, anomalyExplanations, anomalyCount } = useMemo(() => {
    if (!data || data.labPoints.length < 3) {
      return { anomalyMap: new Map<string, AnomalyResult[]>(), anomalyExplanations: [] as AnomalyExplanation[], anomalyCount: 0 };
    }

    // Group lab points by marker
    const byMarker: Record<string, { value: number; timestamp: number }[]> = {};
    for (const lab of data.labPoints) {
      if (!byMarker[lab.marker]) byMarker[lab.marker] = [];
      byMarker[lab.marker].push({ value: lab.value, timestamp: lab.testedAt });
    }

    // Detect anomalies per marker (15% threshold, window of 3 for sparse lab data)
    const anomalyMap = new Map<string, AnomalyResult[]>();
    let totalAnomalies = 0;

    for (const [marker, points] of Object.entries(byMarker)) {
      if (points.length < 3) continue;
      const anomalies = detectAnomalies(points, 0.15, Math.min(points.length, 5));
      if (anomalies.length > 0) {
        anomalyMap.set(marker, anomalies);
        totalAnomalies += anomalies.length;
      }
    }

    // Collect all protocol log timestamps for activity-drop detection
    const allLogTimestamps = data.streaks.flatMap(s => {
      const days: number[] = [];
      for (let t = s.startDate; t <= s.endDate; t += 24 * 60 * 60 * 1000) {
        days.push(t);
      }
      return days;
    });

    // Generate causal explanations
    const explanations = generateAnomalyExplanations(anomalyMap, data.streaks, allLogTimestamps);

    return { anomalyMap, anomalyExplanations: explanations, anomalyCount: totalAnomalies };
  }, [data]);

  // Build unified timeline entries sorted by date
  const timelineEntries = useMemo(() => {
    if (!data) return [];

    type Entry = {
      type: 'streak' | 'lab' | 'correlation' | 'anomaly';
      timestamp: number;
      key: string;
      streak?: typeof data.streaks[0];
      lab?: typeof data.labPoints[0];
      correlation?: typeof data.correlations[0];
      anomalyData?: { marker: string; anomaly: AnomalyResult; explanation: AnomalyExplanation | undefined };
    };

    const entries: Entry[] = [];

    // Add streaks
    for (const s of data.streaks) {
      entries.push({
        type: 'streak',
        timestamp: s.endDate,
        key: `streak-${s.protocolName}-${s.startDate}`,
        streak: s,
      });
    }

    // Add lab points
    for (const l of data.labPoints) {
      entries.push({
        type: 'lab',
        timestamp: l.testedAt,
        key: `lab-${l.marker}-${l.testedAt}`,
        lab: l,
      });
    }

    // Add correlations as overlay markers
    for (const c of data.correlations) {
      entries.push({
        type: 'correlation',
        timestamp: c.labDate,
        key: `corr-${c.protocolName}-${c.marker}-${c.labDate}`,
        correlation: c,
      });
    }

    // Add anomaly entries
    for (const [marker, anomalies] of anomalyMap) {
      for (const anomaly of anomalies) {
        const explanation = anomalyExplanations.find(
          e => e.marker === marker && e.anomaly.timestamp === anomaly.timestamp
        );
        entries.push({
          type: 'anomaly',
          timestamp: anomaly.timestamp,
          key: `anomaly-${marker}-${anomaly.timestamp}`,
          anomalyData: { marker, anomaly, explanation },
        });
      }
    }

    // Sort newest first
    entries.sort((a, b) => b.timestamp - a.timestamp);

    // Deduplicate: if a correlation exists for a lab, merge them
    const corrLabKeys = new Set(data.correlations.map(c => `lab-${c.marker}-${c.labDate}`));
    // Also deduplicate anomaly labs — keep anomaly entry, remove plain lab
    const anomalyLabKeys = new Set<string>();
    for (const [marker, anomalies] of anomalyMap) {
      for (const a of anomalies) {
        anomalyLabKeys.add(`lab-${marker}-${a.timestamp}`);
      }
    }

    const filtered = entries.filter(e => {
      if (e.type === 'lab' && corrLabKeys.has(e.key)) return false;
      if (e.type === 'lab' && anomalyLabKeys.has(e.key)) return false;
      return true;
    });

    return filtered.slice(0, maxItems);
  }, [data, maxItems, anomalyMap, anomalyExplanations]);

  // Correlation lookup for glow effects
  const correlationMap = useMemo(() => {
    if (!data) return new Map<string, typeof data.correlations[0]>();
    const map = new Map<string, (typeof data.correlations)[0]>();
    for (const c of data.correlations) {
      map.set(`${c.protocolName}-${c.marker}`, c);
    }
    return map;
  }, [data]);

  if (!data) {
    return (
      <div className={`${className}`}>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
          <span className="text-xs text-white/30 tracking-widest uppercase">Loading Timeline</span>
        </div>
      </div>
    );
  }

  const hasData = timelineEntries.length > 0;

  if (!hasData) {
    return (
      <div className={`${className}`}>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-12 h-12 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
            <span className="text-lg">{'\u{1F9EC}'}</span>
          </div>
          <div className="text-center">
            <p className="text-sm text-white/40 font-medium">No timeline data yet</p>
            <p className="text-xs text-white/20 mt-1">Complete protocols and log labs to see correlations</p>
          </div>
        </div>
      </div>
    );
  }

  // Count negative anomalies for the header badge
  const negativeAnomalyCount = anomalyExplanations.filter(e => e.isNegative).length;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/[0.06] flex items-center justify-center">
            <span className="text-sm">{'\u{1F9EC}'}</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white/90 tracking-wide">Bio-Timeline</h3>
            <p className="text-[10px] text-white/30 tracking-wider uppercase mt-0.5">
              {data.totalProtocolLogs} protocols {'\u00B7'} {data.totalLabResults} labs {'\u00B7'} {data.correlations.length} correlations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Anomaly badge */}
          {anomalyCount > 0 && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
              negativeAnomalyCount > 0
                ? 'bg-red-500/10 border-red-500/20'
                : 'bg-amber-500/10 border-amber-500/20'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                negativeAnomalyCount > 0 ? 'bg-red-400' : 'bg-amber-400'
              }`} style={{ animation: 'anomalyPulse 1.8s ease-in-out infinite' }} />
              <span className={`text-[10px] font-medium tracking-wide ${
                negativeAnomalyCount > 0 ? 'text-red-400' : 'text-amber-400'
              }`}>
                {anomalyCount} {anomalyCount === 1 ? 'anomaly' : 'anomalies'}
              </span>
            </div>
          )}
          {/* Correlation badge */}
          {data.correlations.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-medium tracking-wide">
                {data.correlations.length} proven
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Anomaly Summary Panel ── */}
      {anomalyExplanations.length > 0 && (
        <div className="mb-5 rounded-xl border overflow-hidden"
          style={{
            background: negativeAnomalyCount > 0
              ? 'linear-gradient(135deg, rgba(239,68,68,0.06) 0%, rgba(239,68,68,0.02) 100%)'
              : 'linear-gradient(135deg, rgba(251,191,36,0.06) 0%, rgba(251,191,36,0.02) 100%)',
            borderColor: negativeAnomalyCount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.15)',
          }}
        >
          {/* Summary header */}
          <div className="px-4 py-3 flex items-center gap-2.5 border-b"
            style={{ borderColor: negativeAnomalyCount > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)' }}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{
                background: negativeAnomalyCount > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.15)',
                boxShadow: negativeAnomalyCount > 0
                  ? '0 0 12px rgba(239,68,68,0.3)'
                  : '0 0 12px rgba(251,191,36,0.3)',
                animation: 'anomalyGlow 2.5s ease-in-out infinite',
              }}
            >
              <span className="text-xs">{negativeAnomalyCount > 0 ? '\u26A0\uFE0F' : '\u{1F50D}'}</span>
            </div>
            <div className="flex-1">
              <span className={`text-[10px] font-semibold tracking-wider uppercase ${
                negativeAnomalyCount > 0 ? 'text-red-400' : 'text-amber-400'
              }`}>
                System Warning {'\u2014'} Anomaly Detection
              </span>
            </div>
            <span className="text-[9px] text-white/20 font-mono">
              {anomalyExplanations.length} {anomalyExplanations.length === 1 ? 'signal' : 'signals'}
            </span>
          </div>

          {/* Explanation list */}
          <div className="divide-y" style={{ borderColor: negativeAnomalyCount > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.08)' }}>
            {anomalyExplanations.slice(0, 4).map((exp, i) => (
              <div
                key={`exp-${exp.marker}-${exp.anomaly.timestamp}-${i}`}
                className="px-4 py-3 group cursor-pointer transition-colors duration-200"
                style={{
                  background: hoveredAnomaly === `${exp.marker}-${exp.anomaly.timestamp}`
                    ? (exp.isNegative ? 'rgba(239,68,68,0.06)' : 'rgba(251,191,36,0.06)')
                    : 'transparent',
                }}
                onMouseEnter={() => setHoveredAnomaly(`${exp.marker}-${exp.anomaly.timestamp}`)}
                onMouseLeave={() => setHoveredAnomaly(null)}
                onClick={() => setExpandedAnomaly(
                  expandedAnomaly === `${exp.marker}-${exp.anomaly.timestamp}`
                    ? null
                    : `${exp.marker}-${exp.anomaly.timestamp}`
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Severity indicator */}
                  <div className="mt-0.5 flex-shrink-0">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        exp.anomaly.severity === 'critical'
                          ? 'bg-red-400'
                          : exp.isNegative ? 'bg-red-400/70' : 'bg-amber-400/70'
                      }`}
                      style={{
                        boxShadow: exp.anomaly.severity === 'critical'
                          ? '0 0 8px rgba(239,68,68,0.6)'
                          : exp.isNegative
                            ? '0 0 6px rgba(239,68,68,0.3)'
                            : '0 0 6px rgba(251,191,36,0.3)',
                        animation: exp.anomaly.severity === 'critical' ? 'anomalyPulse 1.5s ease-in-out infinite' : 'none',
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Cause text */}
                    <p className="text-[11px] text-white/70 leading-relaxed">
                      {exp.likelyCause}
                    </p>

                    {/* Deviation stats */}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[9px] text-white/30 font-mono">
                        {formatDate(exp.anomaly.timestamp)}
                      </span>
                      <span className={`text-[9px] font-semibold font-mono ${
                        exp.isNegative ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {formatDeviation(exp.anomaly.deviationPct)} from avg
                      </span>
                      <span className="text-[9px] text-white/20">
                        avg: {exp.anomaly.movingAvg.toFixed(1)} {'\u2192'} {exp.anomaly.value.toFixed(1)}
                      </span>
                    </div>

                    {/* Expanded detail: skipped protocols */}
                    {expandedAnomaly === `${exp.marker}-${exp.anomaly.timestamp}` && exp.skippedProtocols.length > 0 && (
                      <div className="mt-2.5 pl-0 flex flex-wrap gap-1.5"
                        style={{
                          opacity: 1,
                          animation: 'anomalyFadeIn 0.3s ease-out',
                        }}
                      >
                        <span className="text-[9px] text-white/25 uppercase tracking-wider mr-1 self-center">
                          Missing:
                        </span>
                        {exp.skippedProtocols.map(p => (
                          <span
                            key={p}
                            className="text-[9px] px-2 py-0.5 rounded-full border font-medium"
                            style={{
                              background: 'rgba(239,68,68,0.08)',
                              borderColor: 'rgba(239,68,68,0.2)',
                              color: 'rgba(248,113,113,0.9)',
                            }}
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* More anomalies indicator */}
          {anomalyExplanations.length > 4 && (
            <div className="px-4 py-2 text-center border-t"
              style={{ borderColor: negativeAnomalyCount > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.08)' }}
            >
              <span className="text-[9px] text-white/20">
                +{anomalyExplanations.length - 4} more {anomalyExplanations.length - 4 === 1 ? 'anomaly' : 'anomalies'} detected
              </span>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Central spine */}
        <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gradient-to-b from-white/[0.08] via-white/[0.04] to-transparent" />

        <div className="flex flex-col gap-1">
          {timelineEntries.map((entry, idx) => {
            const delay = Math.min(idx * 60, 600);

            /* ── ANOMALY ENTRY ── */
            if (entry.type === 'anomaly' && entry.anomalyData) {
              const { marker, anomaly, explanation } = entry.anomalyData;
              const isNeg = explanation?.isNegative ?? true;
              const anomalyKey = `${marker}-${anomaly.timestamp}`;
              const isHovered = hoveredAnomaly === anomalyKey;

              return (
                <div
                  key={entry.key}
                  className="relative flex items-start gap-4 py-3"
                  style={{
                    opacity: animatedIn ? 1 : 0,
                    transform: animatedIn ? 'translateX(0)' : 'translateX(-12px)',
                    transition: `all 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
                  }}
                  onMouseEnter={() => setHoveredAnomaly(anomalyKey)}
                  onMouseLeave={() => setHoveredAnomaly(null)}
                >
                  {/* Anomaly Warning Node */}
                  <div className="relative z-10 flex-shrink-0 mt-0.5">
                    <div
                      className="w-[38px] h-[38px] rounded-full flex items-center justify-center border-2"
                      style={{
                        background: isNeg ? 'rgba(239,68,68,0.12)' : 'rgba(251,191,36,0.12)',
                        borderColor: isHovered
                          ? (isNeg ? 'rgba(239,68,68,0.6)' : 'rgba(251,191,36,0.6)')
                          : (isNeg ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.3)'),
                        boxShadow: isHovered
                          ? `0 0 24px ${isNeg ? 'rgba(239,68,68,0.5)' : 'rgba(251,191,36,0.5)'}, 0 0 48px ${isNeg ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.2)'}`
                          : `0 0 12px ${isNeg ? 'rgba(239,68,68,0.25)' : 'rgba(251,191,36,0.25)'}`,
                        transition: 'all 0.4s ease',
                      }}
                    >
                      <span className="text-sm">{isNeg ? '\u26A0\uFE0F' : '\u{1F50D}'}</span>
                    </div>
                    {/* Pulsing warning ring */}
                    <div
                      className="absolute inset-0 rounded-full border"
                      style={{
                        borderColor: isNeg ? 'rgba(239,68,68,0.3)' : 'rgba(251,191,36,0.3)',
                        animation: 'anomalyRingPulse 2s ease-in-out infinite',
                      }}
                    />
                    {/* Second ring for critical */}
                    {anomaly.severity === 'critical' && (
                      <div
                        className="absolute inset-[-4px] rounded-full border"
                        style={{
                          borderColor: 'rgba(239,68,68,0.15)',
                          animation: 'anomalyRingPulse 2s ease-in-out infinite 0.5s',
                        }}
                      />
                    )}
                  </div>

                  {/* Anomaly Content Card */}
                  <div
                    className="flex-1 min-w-0 rounded-xl p-3 border cursor-pointer"
                    style={{
                      background: isHovered
                        ? (isNeg ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.08)')
                        : (isNeg ? 'rgba(239,68,68,0.03)' : 'rgba(251,191,36,0.03)'),
                      borderColor: isHovered
                        ? (isNeg ? 'rgba(239,68,68,0.25)' : 'rgba(251,191,36,0.25)')
                        : (isNeg ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)'),
                      boxShadow: isHovered
                        ? `0 0 30px ${isNeg ? 'rgba(239,68,68,0.12)' : 'rgba(251,191,36,0.12)'}`
                        : 'none',
                      transition: 'all 0.4s ease',
                    }}
                    onClick={() => setExpandedAnomaly(expandedAnomaly === anomalyKey ? null : anomalyKey)}
                  >
                    {/* Badge */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold tracking-wider uppercase ${
                        anomaly.severity === 'critical'
                          ? 'bg-red-500/20 text-red-400'
                          : isNeg
                            ? 'bg-red-500/15 text-red-400/80'
                            : 'bg-amber-500/15 text-amber-400/80'
                      }`}>
                        {anomaly.severity === 'critical' ? 'Critical Anomaly' : 'System Warning'}
                      </span>
                      <span className="text-[9px] text-white/20 font-mono">{daysAgo(anomaly.timestamp)}</span>
                    </div>

                    {/* Marker + deviation */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-semibold text-white/80">{marker}</span>
                      <span className={`text-[10px] font-bold font-mono ${
                        isNeg ? 'text-red-400' : 'text-amber-400'
                      }`}>
                        {formatDeviation(anomaly.deviationPct)}
                      </span>
                      <span className="text-[9px] text-white/25 font-mono">
                        avg {anomaly.movingAvg.toFixed(1)} {'\u2192'} {anomaly.value.toFixed(1)}
                      </span>
                    </div>

                    {/* Explanation text */}
                    {explanation && (
                      <p className={`text-[10px] leading-relaxed mt-1 ${
                        isNeg ? 'text-red-400/60' : 'text-amber-400/60'
                      }`}>
                        {explanation.likelyCause}
                      </p>
                    )}

                    {/* Expanded: skipped protocols */}
                    {expandedAnomaly === anomalyKey && explanation && explanation.skippedProtocols.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t flex flex-wrap gap-1.5"
                        style={{
                          borderColor: isNeg ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)',
                          animation: 'anomalyFadeIn 0.3s ease-out',
                        }}
                      >
                        <span className="text-[9px] text-white/25 uppercase tracking-wider mr-1 self-center">
                          Protocols missed:
                        </span>
                        {explanation.skippedProtocols.map(p => (
                          <span
                            key={p}
                            className="text-[9px] px-2 py-0.5 rounded-full border font-medium"
                            style={{
                              background: isNeg ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.08)',
                              borderColor: isNeg ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.2)',
                              color: isNeg ? 'rgba(248,113,113,0.9)' : 'rgba(251,191,36,0.9)',
                            }}
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            /* ── STREAK ENTRY ── */
            if (entry.type === 'streak' && entry.streak) {
              const s = entry.streak;
              const colors = CATEGORY_COLORS[s.category] || DEFAULT_COLOR;
              const isCorrelated = data.correlations.some(c => c.protocolName === s.protocolName);
              const corrKey = data.correlations.find(c => c.protocolName === s.protocolName);
              const isHovered = corrKey ? hoveredCorrelation === `${corrKey.protocolName}-${corrKey.marker}` : false;

              return (
                <div
                  key={entry.key}
                  className="relative flex items-start gap-4 py-2.5 group"
                  style={{
                    opacity: animatedIn ? 1 : 0,
                    transform: animatedIn ? 'translateX(0)' : 'translateX(-12px)',
                    transition: `all 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
                  }}
                  onMouseEnter={() => corrKey && setHoveredCorrelation(`${corrKey.protocolName}-${corrKey.marker}`)}
                  onMouseLeave={() => setHoveredCorrelation(null)}
                >
                  {/* Node */}
                  <div className="relative z-10 flex-shrink-0 mt-0.5">
                    <div
                      className="w-[38px] h-[38px] rounded-full flex items-center justify-center border"
                      style={{
                        background: colors.bg,
                        borderColor: isCorrelated ? colors.glow : 'rgba(255,255,255,0.06)',
                        boxShadow: isHovered ? `0 0 20px ${colors.glow}, 0 0 40px ${colors.glow}` : isCorrelated ? `0 0 12px ${colors.glow}` : 'none',
                        transition: 'box-shadow 0.4s ease',
                      }}
                    >
                      <span className="text-sm">
                        {s.category === 'supplement' ? '\u{1F48A}' : s.category === 'training' ? '\u{1F3CB}\uFE0F' : s.category === 'recovery' ? '\u{1F9CA}' : s.category === 'nutrition' ? '\u{1F957}' : '\u26A1'}
                      </span>
                    </div>
                    {/* Streak count badge */}
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black/80 border border-white/10 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-white/80">{s.streakDays}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white/80 truncate">{s.protocolName}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] ${colors.text} font-medium`}>
                        {s.streakDays}d streak
                      </span>
                    </div>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {formatDateRange(s.startDate, s.endDate)} {'\u00B7'} {s.logCount} logs
                    </p>

                    {/* Streak bar visualization */}
                    <div className="mt-2 flex gap-[2px]">
                      {Array.from({ length: Math.min(s.streakDays, 30) }).map((_, i) => (
                        <div
                          key={i}
                          className="h-[3px] rounded-full flex-1"
                          style={{
                            background: colors.line,
                            opacity: 0.4 + (i / s.streakDays) * 0.6,
                            transition: `opacity 0.3s ease ${i * 20}ms`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            /* ── LAB ENTRY ── */
            if (entry.type === 'lab' && entry.lab) {
              const l = entry.lab;
              return (
                <div
                  key={entry.key}
                  className="relative flex items-start gap-4 py-2.5"
                  style={{
                    opacity: animatedIn ? 1 : 0,
                    transform: animatedIn ? 'translateX(0)' : 'translateX(-12px)',
                    transition: `all 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
                  }}
                >
                  {/* Node */}
                  <div className="relative z-10 flex-shrink-0 mt-0.5">
                    <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center bg-white/[0.04] border border-white/[0.08]">
                      <span className="text-sm">{'\u{1F9EA}'}</span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white/80">{l.marker}</span>
                      <span className="text-[10px] text-white/50 font-mono">
                        {l.value} {l.unit}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {formatDate(l.testedAt)} {'\u00B7'} {daysAgo(l.testedAt)} {'\u00B7'} {l.source}
                    </p>
                  </div>
                </div>
              );
            }

            /* ── CORRELATION ENTRY ── */
            if (entry.type === 'correlation' && entry.correlation) {
              const c = entry.correlation;
              const corrId = `${c.protocolName}-${c.marker}`;
              const isHovered = hoveredCorrelation === corrId;
              const streakColors = CATEGORY_COLORS[
                data.streaks.find(s => s.protocolName === c.protocolName)?.category ?? ''
              ] || DEFAULT_COLOR;

              return (
                <div
                  key={entry.key}
                  className="relative flex items-start gap-4 py-3"
                  style={{
                    opacity: animatedIn ? 1 : 0,
                    transform: animatedIn ? 'translateX(0)' : 'translateX(-12px)',
                    transition: `all 0.5s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
                  }}
                  onMouseEnter={() => setHoveredCorrelation(corrId)}
                  onMouseLeave={() => setHoveredCorrelation(null)}
                >
                  {/* Correlation Glow Node */}
                  <div className="relative z-10 flex-shrink-0 mt-0.5">
                    <div
                      className="w-[38px] h-[38px] rounded-full flex items-center justify-center border-2"
                      style={{
                        background: 'rgba(16,185,129,0.12)',
                        borderColor: isHovered ? 'rgba(16,185,129,0.6)' : 'rgba(16,185,129,0.3)',
                        boxShadow: isHovered
                          ? '0 0 24px rgba(16,185,129,0.5), 0 0 48px rgba(16,185,129,0.25)'
                          : '0 0 12px rgba(16,185,129,0.2)',
                        transition: 'all 0.4s ease',
                      }}
                    >
                      <span className="text-sm">{'\u2728'}</span>
                    </div>
                    {/* Pulsing ring */}
                    <div
                      className="absolute inset-0 rounded-full border border-emerald-400/30"
                      style={{
                        animation: 'correlationPulse 2.5s ease-in-out infinite',
                      }}
                    />
                  </div>

                  {/* Correlation Content */}
                  <div
                    className="flex-1 min-w-0 rounded-xl p-3 border"
                    style={{
                      background: isHovered
                        ? 'rgba(16,185,129,0.08)'
                        : 'rgba(16,185,129,0.03)',
                      borderColor: isHovered
                        ? 'rgba(16,185,129,0.25)'
                        : 'rgba(16,185,129,0.1)',
                      boxShadow: isHovered
                        ? '0 0 30px rgba(16,185,129,0.15), inset 0 0 20px rgba(16,185,129,0.05)'
                        : 'none',
                      transition: 'all 0.4s ease',
                    }}
                  >
                    {/* Correlation header */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold tracking-wider uppercase">
                        Correlation Detected
                      </span>
                    </div>

                    {/* Visual connection */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: streakColors.glow }}
                        />
                        <span className="text-[11px] font-medium text-white/70">{c.protocolName}</span>
                        <span className="text-[9px] text-white/30">{c.streakDays}d</span>
                      </div>
                      <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/30 via-emerald-400/50 to-emerald-500/30 relative">
                        <div
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400"
                          style={{ animation: 'correlationDot 1.5s ease-in-out infinite' }}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-white/70">{c.marker}</span>
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      </div>
                    </div>

                    {/* Delta display */}
                    {c.delta !== null && (
                      <div className="flex items-center gap-3">
                        {c.labBefore !== null && (
                          <span className="text-[10px] text-white/30 font-mono">{c.labBefore}</span>
                        )}
                        <span className="text-[10px] text-white/20">{'\u2192'}</span>
                        <span className="text-[11px] text-emerald-400 font-semibold font-mono">{c.labAfter}</span>
                        <span className={`text-[10px] font-semibold ${
                          c.isPositive ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {c.delta > 0 ? '+' : ''}{c.delta.toFixed(1)}
                        </span>
                      </div>
                    )}

                    <p className="text-[10px] text-emerald-400/60 mt-1.5 italic">
                      {c.streakDays} days of {c.protocolName} preceded this {c.marker} improvement
                    </p>
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-white/[0.04] flex flex-wrap gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400/40" />
          <span className="text-[9px] text-white/30 tracking-wider uppercase">Protocol Streak</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
          <span className="text-[9px] text-white/30 tracking-wider uppercase">Lab Result</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/50" style={{ boxShadow: '0 0 6px rgba(16,185,129,0.4)' }} />
          <span className="text-[9px] text-white/30 tracking-wider uppercase">Correlation Glow</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" style={{ boxShadow: '0 0 6px rgba(239,68,68,0.4)' }} />
          <span className="text-[9px] text-white/30 tracking-wider uppercase">Anomaly Warning</span>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes correlationPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes correlationDot {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          50% { transform: translate(-50%, -50%) scale(1.8); opacity: 0.3; }
        }
        @keyframes anomalyPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.15); }
        }
        @keyframes anomalyRingPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes anomalyGlow {
          0%, 100% { box-shadow: 0 0 8px rgba(239,68,68,0.2); }
          50% { box-shadow: 0 0 20px rgba(239,68,68,0.4), 0 0 40px rgba(239,68,68,0.15); }
        }
        @keyframes anomalyFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
