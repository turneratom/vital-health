import { useState, useEffect, useMemo, useCallback } from 'react';
import { useBiometricSync } from '@/hooks/useBiometricSync';
import {
  runBioIntelligence,
  getStatusColor,
  getUrgencyColor,
  type Intervention,
  type BiologicalState,
  type BioIntelligenceReport,
} from '@/lib/BioIntelligence';
import {
  computeProtocolContext,
  getProtocolHighlight,
  getGlowIntensity,
  type ProtocolHighlight,
  type ProtocolContextState,
  type ProactiveUrgency,
} from '@/lib/ProtocolContextEngine';
import type { BiometricInputs } from '@/lib/IntelligenceEngine';

/* ══════════════════════════════════════════════════════════════
   PROTOCOL STACK — Context-Aware Daily Intelligence Feed
   
   Now driven by the ProtocolContextEngine: when the AI Brain
   detects a biomarker trend (low HRV, high glucose, poor sleep),
   the corresponding protocol card automatically highlights with
   a Proximity Glow, contextual brief, and proactive urgency badge.
   
   Feels like a proactive assistant, not a static checklist.
   ══════════════════════════════════════════════════════════════ */

/* ── Palette — monochromatic with subtle accent ── */
const P = {
  bg: 'rgba(12,12,14,0.85)',
  card: 'rgba(18,18,22,0.7)',
  cardBorder: 'rgba(255,255,255,0.06)',
  cardHover: 'rgba(255,255,255,0.03)',
  text: '#E8E8EC',
  muted: 'rgba(255,255,255,0.4)',
  dim: 'rgba(255,255,255,0.2)',
  glass: 'blur(24px) saturate(1.3)',
};

/* ── Proactive Status Banner ── */
function ProactiveStatusBanner({ context }: { context: ProtocolContextState }) {
  if (!context.isProactive) return null;

  const critCount = context.highlights.filter(h => h.urgency === 'critical').length;
  const elevCount = context.highlights.filter(h => h.urgency === 'elevated').length;
  const color = critCount > 0 ? '#FF6B6B' : '#FFB86B';

  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-4"
      style={{
        background: `linear-gradient(135deg, ${color}08, ${color}03)`,
        border: `1px solid ${color}20`,
        backdropFilter: P.glass,
        WebkitBackdropFilter: P.glass,
        animation: 'proactivePulse 3s ease-in-out infinite',
      }}
    >
      {/* Animated top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
        background: `linear-gradient(90deg, transparent, ${color}60, transparent)`,
        animation: 'proactiveSweep 4s ease-in-out infinite',
      }} />

      <div className="px-4 py-3">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full" style={{
              background: color,
              boxShadow: `0 0 8px ${color}60`,
              animation: 'proactiveDot 1.5s ease-in-out infinite',
            }} />
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full" style={{
              background: color,
              animation: 'proactiveRing 1.5s ease-out infinite',
            }} />
          </div>
          <span className="font-mono text-[9px] tracking-[0.12em] uppercase font-bold" style={{ color }}>
            Proactive Intelligence Active
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            {critCount > 0 && (
              <span className="px-2 py-0.5 rounded-full font-mono text-[7px] font-bold" style={{
                background: 'rgba(255,107,107,0.12)',
                color: '#FF6B6B',
                border: '1px solid rgba(255,107,107,0.2)',
              }}>
                {critCount} CRITICAL
              </span>
            )}
            {elevCount > 0 && (
              <span className="px-2 py-0.5 rounded-full font-mono text-[7px] font-bold" style={{
                background: 'rgba(255,184,107,0.1)',
                color: '#FFB86B',
                border: '1px solid rgba(255,184,107,0.15)',
              }}>
                {elevCount} ELEVATED
              </span>
            )}
          </div>
        </div>
        <p className="font-mono text-[10px] leading-relaxed" style={{ color: P.muted }}>
          {context.statusMessage}
        </p>
      </div>
    </div>
  );
}

/* ── Biomarker Signal Card — shows WHY a protocol is highlighted ── */
function BiomarkerSignalCard({ highlight }: { highlight: ProtocolHighlight }) {
  const [showBrief, setShowBrief] = useState(false);
  const glow = getGlowIntensity(highlight.urgency);

  return (
    <div
      className="relative rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background: `${highlight.glowColor}06`,
        border: `1px solid ${highlight.glowColor}${Math.round(glow.borderOpacity * 255).toString(16).padStart(2, '0')}`,
        boxShadow: glow.glowOpacity > 0
          ? `0 0 ${glow.glowSpread}px ${highlight.glowColor}${Math.round(glow.glowOpacity * 255).toString(16).padStart(2, '0')}, inset 0 1px 0 ${highlight.glowColor}08`
          : 'none',
        animation: glow.glowOpacity > 0 ? `contextGlow ${glow.pulseSpeed} ease-in-out infinite` : 'none',
      }}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm">{highlight.triggerIcon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] font-bold tracking-wide" style={{ color: highlight.glowColor }}>
                {highlight.triggerMarker}
              </span>
              <span className="font-mono text-[8px] tabular-nums" style={{ color: `${highlight.glowColor}AA` }}>
                {highlight.triggerValue}
              </span>
              <span className="font-mono text-[7px]" style={{ color: P.dim }}>
                optimal: {highlight.optimalRange}
              </span>
            </div>
          </div>
          <UrgencyPill urgency={highlight.urgency} color={highlight.glowColor} />
        </div>
        <p className="font-mono text-[9px] leading-relaxed" style={{ color: P.muted }}>
          {highlight.reason}
        </p>

        {/* Expandable brief */}
        <button
          onClick={() => setShowBrief(!showBrief)}
          className="mt-1.5 flex items-center gap-1 transition-colors duration-200"
          style={{ color: `${highlight.glowColor}80` }}
        >
          <span className="font-mono text-[7px] tracking-[0.12em] uppercase font-semibold">
            {showBrief ? 'Hide Analysis' : 'Why This Matters'}
          </span>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            style={{ transform: showBrief ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showBrief && (
          <div className="mt-2 px-2.5 py-2 rounded-lg" style={{
            background: `${highlight.glowColor}04`,
            border: `1px solid ${highlight.glowColor}10`,
            animation: 'briefSlideIn 0.25s ease both',
          }}>
            <p className="font-mono text-[9px] leading-[1.7]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {highlight.brief}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Urgency Pill ── */
function UrgencyPill({ urgency, color }: { urgency: ProactiveUrgency; color: string }) {
  if (urgency === 'neutral') return null;
  const labels: Record<ProactiveUrgency, string> = {
    critical: 'CRITICAL',
    elevated: 'ELEVATED',
    suggested: 'SUGGESTED',
    neutral: '',
  };
  return (
    <span className="px-1.5 py-0.5 rounded-full font-mono text-[6px] tracking-[0.15em] font-bold" style={{
      background: `${color}12`,
      color: `${color}CC`,
      border: `1px solid ${color}20`,
      animation: urgency === 'critical' ? 'urgencyPulse 1.5s ease-in-out infinite' : 'none',
    }}>
      {labels[urgency]}
    </span>
  );
}

/* ── Optimization Score Ring ── */
function OptimizationRing({ score }: { score: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 80 ? '#00FFCC' : score >= 60 ? '#6B8AFF' : score >= 40 ? '#FFB86B' : '#FF6B6B';

  return (
    <div className="relative flex-shrink-0" style={{ width: 96, height: 96 }}>
      <svg viewBox="0 0 96 96" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
        <circle
          cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1), stroke 0.6s',
            filter: `drop-shadow(0 0 8px ${color}40)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-bold tabular-nums tracking-tight" style={{
          color,
          textShadow: `0 0 16px ${color}30`,
        }}>
          {score}
        </span>
        <span className="font-mono text-[8px] tracking-[0.15em] uppercase" style={{ color: P.dim }}>
          OPT %
        </span>
      </div>
    </div>
  );
}

/* ── System Status Dots ── */
function SystemDots({ state }: { state: BiologicalState }) {
  const top4 = state.systems.slice(0, 4);
  return (
    <div className="flex items-center gap-3">
      {top4.map((sys) => (
        <div key={sys.system} className="flex items-center gap-1.5">
          <div className="w-[5px] h-[5px] rounded-full" style={{
            background: getStatusColor(sys.status),
            boxShadow: `0 0 4px ${getStatusColor(sys.status)}50`,
          }} />
          <span className="font-mono text-[8px] tracking-wider uppercase" style={{ color: P.dim }}>
            {sys.label.split(' ')[0]}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Confidence Bar ── */
function ConfidenceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${color}80, ${color})`,
            boxShadow: `0 0 6px ${color}30`,
            transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
      </div>
      <span className="font-mono text-[9px] tabular-nums font-semibold" style={{ color: `${color}CC` }}>
        {value}%
      </span>
    </div>
  );
}

/* ── Category Badge ── */
function CategoryBadge({ category, color }: { category: string; color: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[8px] tracking-[0.12em] uppercase font-semibold" style={{
      background: `${color}10`,
      color: `${color}CC`,
      border: `1px solid ${color}20`,
    }}>
      {category}
    </span>
  );
}

/* ── Urgency Indicator ── */
function UrgencyDot({ urgency }: { urgency: string }) {
  const color = getUrgencyColor(urgency as any);
  return (
    <div className="flex items-center gap-1">
      <div className="w-1.5 h-1.5 rounded-full" style={{
        background: color,
        boxShadow: `0 0 4px ${color}60`,
        animation: urgency === 'critical' ? 'urgencyPulse 1.5s ease-in-out infinite' : 'none',
      }} />
      <span className="font-mono text-[7px] tracking-[0.15em] uppercase" style={{ color: `${color}AA` }}>
        {urgency}
      </span>
    </div>
  );
}

/* ── Context-Aware Protocol Card ── */
function ProtocolCard({
  intervention,
  index,
  highlight,
}: {
  intervention: Intervention;
  index: number;
  highlight: ProtocolHighlight | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isHighlighted = highlight !== null;
  const glow = highlight ? getGlowIntensity(highlight.urgency) : null;

  return (
    <div
      className="relative rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: isHighlighted
          ? `linear-gradient(135deg, ${highlight!.glowColor}06, ${P.card})`
          : P.card,
        border: `1px solid ${isHighlighted ? `${highlight!.glowColor}${Math.round((glow?.borderOpacity ?? 0.06) * 255).toString(16).padStart(2, '0')}` : P.cardBorder}`,
        backdropFilter: P.glass,
        WebkitBackdropFilter: P.glass,
        boxShadow: isHighlighted && glow
          ? `0 0 ${glow.glowSpread}px ${highlight!.glowColor}${Math.round(glow.glowOpacity * 255).toString(16).padStart(2, '0')}, 0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 ${highlight!.glowColor}08`
          : '0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
        animation: isHighlighted && glow && glow.glowOpacity > 0
          ? `contextGlow ${glow.pulseSpeed} ease-in-out infinite, protocolSlideIn 0.4s ease both ${0.05 * index}s`
          : `protocolSlideIn 0.4s ease both ${0.05 * index}s`,
      }}
    >
      {/* Top accent line — enhanced for highlighted cards */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
        background: isHighlighted
          ? `linear-gradient(90deg, transparent, ${highlight!.glowColor}50, transparent)`
          : `linear-gradient(90deg, transparent, ${intervention.color}30, transparent)`,
        animation: isHighlighted ? 'proactiveSweep 3s ease-in-out infinite' : 'none',
      }} />

      {/* Proactive context badge — only for highlighted cards */}
      {isHighlighted && (
        <div className="px-4 pt-2.5 pb-0">
          <div className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-lg" style={{
            background: `${highlight!.glowColor}06`,
            border: `1px solid ${highlight!.glowColor}12`,
          }}>
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
              background: highlight!.glowColor,
              boxShadow: `0 0 6px ${highlight!.glowColor}60`,
              animation: highlight!.urgency === 'critical' ? 'proactiveDot 1.5s ease-in-out infinite' : 'proactiveDot 2.5s ease-in-out infinite',
            }} />
            <span className="font-mono text-[8px] tracking-[0.1em] uppercase font-bold" style={{ color: `${highlight!.glowColor}CC` }}>
              {highlight!.triggerIcon} {highlight!.triggerMarker}: {highlight!.triggerValue}
            </span>
            <span className="font-mono text-[7px] ml-auto" style={{ color: `${highlight!.glowColor}80` }}>
              optimal: {highlight!.optimalRange}
            </span>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="px-4 py-3.5" style={{ paddingTop: isHighlighted ? '0.5rem' : undefined }}>
        {/* Header row */}
        <div className="flex items-start gap-3 mb-2.5">
          {/* Icon — with glow ring for highlighted */}
          <div className="relative flex-shrink-0">
            {isHighlighted && (
              <div className="absolute -inset-1 rounded-xl" style={{
                background: `${highlight!.glowColor}08`,
                border: `1px solid ${highlight!.glowColor}15`,
                animation: `contextGlow ${glow?.pulseSpeed ?? '3s'} ease-in-out infinite`,
              }} />
            )}
            <div className="relative w-10 h-10 rounded-xl flex items-center justify-center" style={{
              background: `${intervention.color}08`,
              border: `1px solid ${intervention.color}15`,
            }}>
              <span className="text-lg">{intervention.icon}</span>
            </div>
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-[13px] truncate" style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                color: isHighlighted ? highlight!.glowColor : P.text,
                letterSpacing: '-0.01em',
                textShadow: isHighlighted ? `0 0 12px ${highlight!.glowColor}20` : 'none',
              }}>
                {intervention.name}
              </h3>
              {isHighlighted && <UrgencyPill urgency={highlight!.urgency} color={highlight!.glowColor} />}
            </div>
            <div className="flex items-center gap-2">
              <CategoryBadge category={intervention.category} color={intervention.color} />
              <UrgencyDot urgency={intervention.urgency} />
            </div>
          </div>
        </div>

        {/* Headline — use contextual reason for highlighted cards */}
        <p className="text-[11px] leading-relaxed mb-3" style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          color: isHighlighted ? 'rgba(255,255,255,0.55)' : P.muted,
        }}>
          {isHighlighted
            ? highlight!.reason
            : intervention.rationale.length > 160
              ? intervention.rationale.slice(0, 160) + '...'
              : intervention.rationale}
        </p>

        {/* Confidence bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[8px] tracking-[0.12em] uppercase" style={{ color: P.dim }}>
              Confidence
            </span>
          </div>
          <ConfidenceBar value={intervention.confidence} color={isHighlighted ? highlight!.glowColor : intervention.color} />
        </div>

        {/* Triggers */}
        {intervention.triggers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {intervention.triggers.slice(0, 3).map((t, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[8px]" style={{
                background: isHighlighted ? `${highlight!.glowColor}06` : 'rgba(255,255,255,0.03)',
                color: isHighlighted ? `${highlight!.glowColor}90` : P.muted,
                border: `1px solid ${isHighlighted ? `${highlight!.glowColor}12` : 'rgba(255,255,255,0.05)'}`,
              }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* "Why This Works" toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between py-2 px-3 rounded-xl transition-all duration-200 hover:bg-white/[0.02] active:scale-[0.99]"
          style={{
            border: `1px solid ${expanded ? `${intervention.color}15` : 'rgba(255,255,255,0.04)'}`,
            background: expanded ? `${intervention.color}04` : 'transparent',
          }}
        >
          <span className="font-mono text-[9px] tracking-[0.1em] uppercase font-semibold" style={{
            color: expanded ? `${intervention.color}CC` : P.dim,
          }}>
            Why This Works
          </span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke={expanded ? intervention.color : 'rgba(255,255,255,0.2)'}
            strokeWidth="2" strokeLinecap="round"
            style={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.3s ease, stroke 0.3s',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Expanded scientific rationale */}
        {expanded && (
          <div className="mt-2.5 space-y-3" style={{ animation: 'rationaleSlideIn 0.3s ease both' }}>
            <div className="px-3 py-2.5 rounded-xl" style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <span className="font-mono text-[7px] tracking-[0.15em] uppercase block mb-1.5" style={{ color: `${intervention.color}80` }}>
                Mechanism of Action
              </span>
              <p className="text-[10px] leading-[1.6] font-mono" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {intervention.mechanism || intervention.rationale}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="px-3 py-2 rounded-xl" style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span className="font-mono text-[7px] tracking-[0.15em] uppercase block mb-1" style={{ color: P.dim }}>Dosing</span>
                <p className="text-[9px] leading-relaxed font-mono" style={{ color: P.muted }}>{intervention.dosing}</p>
              </div>
              <div className="px-3 py-2 rounded-xl" style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span className="font-mono text-[7px] tracking-[0.15em] uppercase block mb-1" style={{ color: P.dim }}>Timing</span>
                <p className="text-[9px] leading-relaxed font-mono" style={{ color: P.muted }}>{intervention.timing}</p>
              </div>
            </div>

            {intervention.expectedOutcomes && intervention.expectedOutcomes.length > 0 && (
              <div className="px-3 py-2 rounded-xl" style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span className="font-mono text-[7px] tracking-[0.15em] uppercase block mb-1.5" style={{ color: P.dim }}>Expected Outcomes</span>
                <div className="space-y-1">
                  {intervention.expectedOutcomes.map((o, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: `${intervention.color}60` }} />
                      <span className="text-[9px] font-mono leading-relaxed" style={{ color: P.muted }}>{o}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {intervention.synergies.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <span className="font-mono text-[7px] tracking-[0.15em] uppercase w-full mb-0.5" style={{ color: P.dim }}>Synergies</span>
                {intervention.synergies.map((s, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[8px]" style={{
                    background: `${intervention.color}06`,
                    color: `${intervention.color}90`,
                    border: `1px solid ${intervention.color}12`,
                  }}>
                    {s}
                  </span>
                ))}
              </div>
            )}

            {intervention.citations.length > 0 && (
              <div className="pt-1">
                <span className="font-mono text-[7px] tracking-[0.15em] uppercase block mb-1" style={{ color: P.dim }}>References</span>
                {intervention.citations.slice(0, 2).map((c, i) => (
                  <p key={i} className="text-[8px] font-mono leading-relaxed mb-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {c.authors} ({c.year}). {c.title}. <em>{c.journal}</em>.
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Risk Flag Banner ── */
function RiskFlagBanner({ flags }: { flags: BiologicalState['riskFlags'] }) {
  if (flags.length === 0) return null;
  const critical = flags.filter(f => f.severity === 'critical');
  const alerts = flags.filter(f => f.severity === 'alert');

  return (
    <div className="rounded-xl px-3.5 py-2.5 mb-4" style={{
      background: critical.length > 0 ? 'rgba(255,107,107,0.06)' : 'rgba(255,184,107,0.04)',
      border: `1px solid ${critical.length > 0 ? 'rgba(255,107,107,0.15)' : 'rgba(255,184,107,0.1)'}`,
    }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs">{critical.length > 0 ? '🚨' : '⚠️'}</span>
        <span className="font-mono text-[9px] tracking-[0.1em] uppercase font-semibold" style={{
          color: critical.length > 0 ? '#FF6B6B' : '#FFB86B',
        }}>
          {critical.length > 0 ? `${critical.length} Critical` : ''}{critical.length > 0 && alerts.length > 0 ? ' · ' : ''}{alerts.length > 0 ? `${alerts.length} Alert${alerts.length > 1 ? 's' : ''}` : ''}
        </span>
      </div>
      <div className="space-y-1">
        {flags.slice(0, 3).map((f) => (
          <div key={f.id} className="flex items-start gap-1.5">
            <span className="text-[9px]">{f.icon}</span>
            <span className="font-mono text-[9px] leading-relaxed" style={{ color: P.muted }}>{f.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT — Context-Aware Protocol Stack Feed
   ══════════════════════════════════════════════════════════════ */

export function ProtocolStack() {
  const { vitals } = useBiometricSync();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Convert SyncedVitals to BiometricInputs
  const inputs: BiometricInputs = useMemo(() => ({
    hrv: vitals.hrv,
    heartRate: vitals.heartRate,
    sleepHours: vitals.sleepHours,
    sleepScore: vitals.sleepScore,
    sleepDeepPct: vitals.sleepDeepPct,
    sleepRemPct: vitals.sleepRemPct,
    recovery: vitals.recovery,
    stress: vitals.stress,
    spo2: vitals.spo2,
    bodyBattery: vitals.bodyBattery,
    strain: vitals.strain,
    skinTemp: vitals.skinTemp,
    respiratoryRate: vitals.respiratoryRate,
    steps: vitals.steps,
    readiness: vitals.readiness,
  }), [vitals]);

  // Run BioIntelligence engine
  const report: BioIntelligenceReport = useMemo(() => runBioIntelligence(inputs), [inputs]);

  // Run Protocol Context Engine — maps biomarker trends to protocol highlights
  const context: ProtocolContextState = useMemo(
    () => computeProtocolContext(inputs, report),
    [inputs, report]
  );

  const topInterventions = report.interventions.slice(0, 8);

  // Sort interventions: highlighted ones first, then by confidence
  const sortedInterventions = useMemo(() => {
    return [...topInterventions].sort((a, b) => {
      const aHighlight = getProtocolHighlight(a.name, a.category, context.highlights);
      const bHighlight = getProtocolHighlight(b.name, b.category, context.highlights);
      const aScore = aHighlight ? (aHighlight.urgency === 'critical' ? 1000 : aHighlight.urgency === 'elevated' ? 500 : 100) : 0;
      const bScore = bHighlight ? (bHighlight.urgency === 'critical' ? 1000 : bHighlight.urgency === 'elevated' ? 500 : 100) : 0;
      if (aScore !== bScore) return bScore - aScore;
      return b.confidence - a.confidence;
    });
  }, [topInterventions, context.highlights]);

  // Unique biomarker signals for the signal cards section
  const uniqueSignals = useMemo(() => {
    const seen = new Set<string>();
    return context.highlights.filter(h => {
      if (seen.has(h.triggerMarker)) return false;
      seen.add(h.triggerMarker);
      return h.urgency === 'critical' || h.urgency === 'elevated';
    }).slice(0, 3);
  }, [context.highlights]);

  return (
    <div style={{
      opacity: mounted ? 1 : 0,
      transform: mounted ? 'translateY(0)' : 'translateY(12px)',
      transition: 'all 0.6s cubic-bezier(0.4,0,0.2,1)',
    }}>
      {/* ── Header: Optimization Score + System Status ── */}
      <div className="flex items-center gap-4 mb-5">
        <OptimizationRing score={report.state.compositeScore} />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold mb-1" style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            color: P.text,
            letterSpacing: '-0.02em',
          }}>
            Daily Intelligence
          </h2>
          <p className="text-[10px] font-mono leading-relaxed mb-2.5" style={{ color: P.muted }}>
            {report.executiveSummary.length > 120
              ? report.executiveSummary.slice(0, 120) + '...'
              : report.executiveSummary}
          </p>
          <SystemDots state={report.state} />
        </div>
      </div>

      {/* ── Proactive Status Banner ── */}
      <ProactiveStatusBanner context={context} />

      {/* ── Biomarker Signal Cards — proactive intelligence ── */}
      {uniqueSignals.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[9px] tracking-[0.12em] uppercase font-semibold" style={{ color: P.dim }}>
              Active Signals
            </span>
            <div className="flex-1 h-[1px]" style={{ background: 'rgba(255,255,255,0.04)' }} />
            <span className="font-mono text-[8px] tabular-nums" style={{ color: P.dim }}>
              {uniqueSignals.length} detected
            </span>
          </div>
          {uniqueSignals.map((signal) => (
            <BiomarkerSignalCard key={signal.triggerMarker} highlight={signal} />
          ))}
        </div>
      )}

      {/* ── Risk Flags ── */}
      <RiskFlagBanner flags={report.state.riskFlags} />

      {/* ── Today&apos;s Priorities ── */}
      <div className="mb-4 px-3.5 py-2.5 rounded-xl" style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
      }}>
        <span className="font-mono text-[8px] tracking-[0.15em] uppercase block mb-2" style={{ color: P.dim }}>
          Today&apos;s Priorities
        </span>
        <div className="space-y-1.5">
          {report.todayPriorities.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-mono text-[9px] font-bold tabular-nums flex-shrink-0" style={{ color: P.dim }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="text-[10px] font-mono leading-relaxed" style={{ color: P.muted }}>
                {p}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Protocol Cards — context-aware with Proximity Glow ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[9px] tracking-[0.12em] uppercase font-semibold" style={{ color: P.dim }}>
            Protocol Stack
          </span>
          <div className="flex items-center gap-3">
            {context.isProactive && (
              <span className="font-mono text-[7px] tracking-[0.1em] uppercase" style={{ color: '#FFB86B' }}>
                {context.urgentCount} proactive
              </span>
            )}
            <span className="font-mono text-[8px] tabular-nums" style={{ color: P.dim }}>
              {sortedInterventions.length} active
            </span>
          </div>
        </div>
        {sortedInterventions.map((intervention, i) => {
          const highlight = getProtocolHighlight(
            intervention.name,
            intervention.category,
            context.highlights
          );
          return (
            <ProtocolCard
              key={intervention.id}
              intervention={intervention}
              index={i}
              highlight={highlight}
            />
          );
        })}
      </div>

      {/* ── Animations ── */}
      <style>{`
        @keyframes protocolSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rationaleSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes briefSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes urgencyPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes contextGlow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes proactivePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.92; }
        }
        @keyframes proactiveSweep {
          0% { opacity: 0.3; transform: translateX(-100%); }
          50% { opacity: 1; transform: translateX(0%); }
          100% { opacity: 0.3; transform: translateX(100%); }
        }
        @keyframes proactiveDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.5); }
        }
        @keyframes proactiveRing {
          0% { opacity: 0.6; transform: scale(1); }
          100% { opacity: 0; transform: scale(3); }
        }
      `}</style>
    </div>
  );
}

export default ProtocolStack;
