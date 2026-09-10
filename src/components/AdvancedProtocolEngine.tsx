import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
  runBioIntelligence,
  getStatusColor,
  getStatusLabel,
  getTrendIcon,
  getTrendColor,
  getUrgencyColor,
  type Intervention,
  type BiologicalState,
  type BioIntelligenceReport,
  type SystemAssessment,
} from '../lib/BioIntelligence';
import type { BiometricInputs } from '../lib/IntelligenceEngine';

/* ══════════════════════════════════════════════════════════════
   ADVANCED PROTOCOL ENGINE — Concierge-Grade Intervention UI
   
   Scans inflammation markers (hs-CRP), Recovery Score, HRV trends,
   and sleep architecture to surface Research Insight cards for:
   • Peptides (BPC-157, CJC-1295/Ipamorelin, TB-500)
   • Nootropics (Apigenin, Creatine, NMN)
   • Hormonal Optimization (Tongkat Ali, Ashwagandha KSM-66)
   • Metabolic (Berberine, Zone 2 Cardio)
   
   The UI feels like a high-end concierge doctor — clinical precision
   with warm, human presentation.
   ══════════════════════════════════════════════════════════════ */

const WARM = {
  accent: '#E8976C',
  green: '#7CB68E',
  amber: '#C4A46C',
  red: '#D4847A',
  purple: '#AF82FF',
  blue: '#6B8AFF',
  cyan: '#00E5FF',
  gold: '#FFD700',
  text: '#E8E0D8',
  muted: '#8A7E72',
  bg: 'rgba(26,24,22,0.97)',
  cardBg: 'rgba(30,28,26,0.95)',
  border: 'rgba(232,151,108,0.1)',
};

const CATEGORY_META: Record<string, { label: string; icon: string; color: string; gradient: string }> = {
  peptide: { label: 'PEPTIDE', icon: '💉', color: WARM.purple, gradient: 'linear-gradient(135deg, rgba(175,130,255,0.12), rgba(175,130,255,0.03))' },
  supplement: { label: 'SUPPLEMENT', icon: '💊', color: WARM.cyan, gradient: 'linear-gradient(135deg, rgba(0,229,255,0.1), rgba(0,229,255,0.02))' },
  holistic: { label: 'HOLISTIC', icon: '🧘', color: WARM.green, gradient: 'linear-gradient(135deg, rgba(124,182,142,0.1), rgba(124,182,142,0.02))' },
  nootropic: { label: 'NOOTROPIC', icon: '🧠', color: WARM.blue, gradient: 'linear-gradient(135deg, rgba(107,138,255,0.1), rgba(107,138,255,0.02))' },
};

interface AdvancedProtocolEngineProps {
  sessionId: string;
  compact?: boolean;
  maxCards?: number;
}

/* ── Animated Confidence Ring ── */
function ConfidenceRing({ value, size = 44, color }: { value: number; size?: number; color: string }) {
  const [animVal, setAnimVal] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimVal(value), 200);
    return () => clearTimeout(t);
  }, [value]);
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (animVal / 100) * circ;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color }}>{animVal}%</span>
      </div>
    </div>
  );
}

/* ── Urgency Badge ── */
function UrgencyBadge({ urgency }: { urgency: string }) {
  const color = getUrgencyColor(urgency as any);
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[8px] font-mono font-bold tracking-widest uppercase"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
    >
      {urgency}
    </span>
  );
}

/* ── Trigger Chip ── */
function TriggerChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono"
      style={{ background: 'rgba(232,151,108,0.08)', color: WARM.accent, border: `1px solid ${WARM.border}` }}>
      <span style={{ color: WARM.red }}>⚡</span> {text}
    </span>
  );
}

/* ── Citation Pill ── */
function CitationPill({ citation }: { citation: { authors: string; title: string; journal: string; year: number; doi?: string } }) {
  return (
    <div className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-[9px] font-mono"
      style={{ background: 'rgba(107,138,255,0.06)', border: `1px solid rgba(107,138,255,0.12)` }}>
      <span style={{ color: WARM.blue }}>📄</span>
      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ color: WARM.text }}>{citation.authors}</div>
        <div className="truncate opacity-70" style={{ color: WARM.muted }}>{citation.title}</div>
        <div style={{ color: WARM.blue }}>{citation.journal} ({citation.year})</div>
      </div>
    </div>
  );
}

/* ── Research Insight Card — The Core UI ── */
function ResearchInsightCard({ intervention, index }: { intervention: Intervention; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [showMechanism, setShowMechanism] = useState(false);
  const [showCitations, setShowCitations] = useState(false);

  const catMeta = CATEGORY_META[intervention.category] || CATEGORY_META.supplement;
  const isHighUrgency = intervention.urgency === 'critical' || intervention.urgency === 'high';

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: catMeta.gradient,
        border: `1px solid ${catMeta.color}20`,
        animation: isHighUrgency ? `apeGlow${index % 3} 4s ease-in-out infinite` : undefined,
      }}
    >
      {/* Urgency pulse strip */}
      {isHighUrgency && (
        <div className="absolute top-0 left-0 right-0 h-[2px]" style={{
          background: `linear-gradient(90deg, transparent, ${catMeta.color}, transparent)`,
          animation: 'apePulseStrip 3s ease-in-out infinite',
        }} />
      )}

      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3.5 flex items-start gap-3"
      >
        {/* Icon + Confidence */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
            style={{ background: `${catMeta.color}15`, border: `1px solid ${catMeta.color}25` }}>
            {intervention.icon}
          </div>
          <ConfidenceRing value={intervention.confidence} size={36} color={catMeta.color} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[8px] font-mono font-bold tracking-[0.15em] uppercase" style={{ color: catMeta.color }}>
              {catMeta.label}
            </span>
            <UrgencyBadge urgency={intervention.urgency} />
          </div>
          <h3 className="text-sm font-semibold leading-tight mb-1.5" style={{ color: WARM.text }}>
            {intervention.name}
          </h3>
          <p className="text-[11px] leading-relaxed" style={{ color: WARM.muted }}>
            {intervention.rationale.length > 180 && !expanded
              ? intervention.rationale.slice(0, 180) + '...'
              : intervention.rationale}
          </p>

          {/* Trigger chips */}
          {intervention.triggers.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {intervention.triggers.slice(0, expanded ? 5 : 2).map((t, i) => (
                <TriggerChip key={i} text={t} />
              ))}
              {!expanded && intervention.triggers.length > 2 && (
                <span className="text-[9px] font-mono" style={{ color: WARM.muted }}>
                  +{intervention.triggers.length - 2} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <div className="flex-shrink-0 mt-1">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s ease' }}>
            <path d="M4 6L8 10L12 6" stroke={WARM.muted} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ animation: 'apeFadeIn 0.3s ease-out' }}>
          {/* Protocol Details Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'DOSING', value: intervention.dosing, icon: '💊' },
              { label: 'TIMING', value: intervention.timing, icon: '⏰' },
              { label: 'DURATION', value: intervention.duration, icon: '📅' },
              { label: 'TARGET', value: intervention.systemTarget.replace(/_/g, ' ').toUpperCase(), icon: '🎯' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${WARM.border}` }}>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[10px]">{item.icon}</span>
                  <span className="text-[8px] font-mono font-bold tracking-[0.12em]" style={{ color: catMeta.color }}>
                    {item.label}
                  </span>
                </div>
                <p className="text-[10px] leading-snug" style={{ color: WARM.text }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Expected Outcomes */}
          <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(124,182,142,0.04)', border: `1px solid rgba(124,182,142,0.12)` }}>
            <div className="text-[8px] font-mono font-bold tracking-[0.12em] mb-1.5" style={{ color: WARM.green }}>
              EXPECTED OUTCOMES
            </div>
            <div className="space-y-1">
              {intervention.expectedOutcomes.map((outcome, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-[8px] mt-0.5" style={{ color: WARM.green }}>✓</span>
                  <span className="text-[10px] leading-snug" style={{ color: WARM.text }}>{outcome}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Synergies + Cautions */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(107,138,255,0.04)', border: `1px solid rgba(107,138,255,0.12)` }}>
              <div className="text-[8px] font-mono font-bold tracking-[0.12em] mb-1.5" style={{ color: WARM.blue }}>
                SYNERGIES
              </div>
              {intervention.synergies.map((s, i) => (
                <div key={i} className="text-[9px] leading-snug mb-0.5" style={{ color: WARM.text }}>
                  <span style={{ color: WARM.blue }}>+</span> {s}
                </div>
              ))}
            </div>
            <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(212,132,122,0.04)', border: `1px solid rgba(212,132,122,0.12)` }}>
              <div className="text-[8px] font-mono font-bold tracking-[0.12em] mb-1.5" style={{ color: WARM.red }}>
                CAUTIONS
              </div>
              {intervention.cautions.map((c, i) => (
                <div key={i} className="text-[9px] leading-snug mb-0.5" style={{ color: WARM.text }}>
                  <span style={{ color: WARM.red }}>⚠</span> {c}
                </div>
              ))}
            </div>
          </div>

          {/* Mechanism of Action (expandable) */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowMechanism(!showMechanism); }}
            className="w-full text-left rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(175,130,255,0.04)', border: `1px solid rgba(175,130,255,0.12)` }}
          >
            <div className="flex items-center justify-between">
              <div className="text-[8px] font-mono font-bold tracking-[0.12em]" style={{ color: WARM.purple }}>
                🔬 MECHANISM OF ACTION
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                style={{ transform: showMechanism ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                <path d="M3 4.5L6 7.5L9 4.5" stroke={WARM.purple} strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
            {showMechanism && (
              <p className="text-[10px] leading-relaxed mt-2" style={{ color: WARM.text, animation: 'apeFadeIn 0.2s ease-out' }}>
                {intervention.mechanism}
              </p>
            )}
          </button>

          {/* Citations */}
          {intervention.citations.length > 0 && (
            <div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowCitations(!showCitations); }}
                className="flex items-center gap-1.5 mb-1.5"
              >
                <span className="text-[8px] font-mono font-bold tracking-[0.12em]" style={{ color: WARM.blue }}>
                  📚 PEER-REVIEWED CITATIONS ({intervention.citations.length})
                </span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                  style={{ transform: showCitations ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <path d="M2.5 3.75L5 6.25L7.5 3.75" stroke={WARM.blue} strokeWidth="1" strokeLinecap="round" />
                </svg>
              </button>
              {showCitations && (
                <div className="space-y-1.5" style={{ animation: 'apeFadeIn 0.2s ease-out' }}>
                  {intervention.citations.map((c, i) => <CitationPill key={i} citation={c} />)}
                </div>
              )}
            </div>
          )}

          {/* Cascade Next */}
          {intervention.cascadeNext && intervention.cascadeNext.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'rgba(232,151,108,0.04)', border: `1px solid ${WARM.border}` }}>
              <span className="text-[9px]">🔗</span>
              <span className="text-[8px] font-mono font-bold tracking-[0.1em]" style={{ color: WARM.accent }}>
                STACK AFTER:
              </span>
              <span className="text-[9px] font-mono" style={{ color: WARM.text }}>
                {intervention.cascadeNext.join(' → ')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── System Status Mini-Card ── */
function SystemMiniCard({ system }: { system: SystemAssessment }) {
  const statusColor = getStatusColor(system.status);
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
      style={{ background: `${statusColor}08`, border: `1px solid ${statusColor}15` }}>
      <span className="text-sm">{system.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-mono font-semibold truncate" style={{ color: WARM.text }}>
          {system.label}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full" style={{
              width: `${system.score}%`,
              background: statusColor,
              transition: 'width 1s ease-out',
            }} />
          </div>
          <span className="text-[8px] font-mono font-bold tabular-nums" style={{ color: statusColor }}>
            {system.score}
          </span>
        </div>
      </div>
      <span className="text-[7px] font-mono font-bold tracking-[0.1em] px-1.5 py-0.5 rounded"
        style={{ background: `${statusColor}15`, color: statusColor }}>
        {getStatusLabel(system.status)}
      </span>
    </div>
  );
}

/* ── Inflammation Scanner Card ── */
function InflammationScanner({ crp, recovery, hrv }: { crp: number | null; recovery: number; hrv: number }) {
  const inflammationLevel = crp !== null
    ? crp > 5 ? 'critical' : crp > 3 ? 'elevated' : crp > 1 ? 'mild' : 'optimal'
    : recovery < 40 ? 'elevated' : recovery < 60 ? 'mild' : 'optimal';

  const levelColors: Record<string, { color: string; bg: string; label: string }> = {
    critical: { color: WARM.red, bg: 'rgba(212,132,122,0.08)', label: 'CRITICAL INFLAMMATION' },
    elevated: { color: WARM.amber, bg: 'rgba(196,164,108,0.06)', label: 'ELEVATED INFLAMMATION' },
    mild: { color: '#E8976C', bg: 'rgba(232,151,108,0.05)', label: 'MILD INFLAMMATION' },
    optimal: { color: WARM.green, bg: 'rgba(124,182,142,0.06)', label: 'INFLAMMATION CONTROLLED' },
  };

  const level = levelColors[inflammationLevel];

  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: level.bg, border: `1px solid ${level.color}20` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{
            background: level.color,
            boxShadow: `0 0 8px ${level.color}40`,
            animation: inflammationLevel !== 'optimal' ? 'apePulse 2s ease-in-out infinite' : undefined,
          }} />
          <span className="text-[8px] font-mono font-bold tracking-[0.15em]" style={{ color: level.color }}>
            {level.label}
          </span>
        </div>
        <span className="text-[8px] font-mono" style={{ color: WARM.muted }}>SYSTEMIC SCAN</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-[8px] font-mono" style={{ color: WARM.muted }}>hs-CRP</div>
          <div className="text-sm font-mono font-bold tabular-nums" style={{ color: crp !== null ? level.color : WARM.muted }}>
            {crp !== null ? `${crp.toFixed(1)}` : '—'}
          </div>
          <div className="text-[8px] font-mono" style={{ color: WARM.muted }}>mg/L</div>
        </div>
        <div>
          <div className="text-[8px] font-mono" style={{ color: WARM.muted }}>RECOVERY</div>
          <div className="text-sm font-mono font-bold tabular-nums" style={{ color: recovery < 50 ? WARM.red : recovery < 70 ? WARM.amber : WARM.green }}>
            {recovery}%
          </div>
          <div className="text-[8px] font-mono" style={{ color: WARM.muted }}>readiness</div>
        </div>
        <div>
          <div className="text-[8px] font-mono" style={{ color: WARM.muted }}>HRV</div>
          <div className="text-sm font-mono font-bold tabular-nums" style={{ color: hrv < 40 ? WARM.red : hrv < 55 ? WARM.amber : WARM.green }}>
            {hrv}
          </div>
          <div className="text-[8px] font-mono" style={{ color: WARM.muted }}>ms</div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function AdvancedProtocolEngine({ sessionId, compact = false, maxCards = 6 }: AdvancedProtocolEngineProps) {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showSystems, setShowSystems] = useState(false);

  // Fetch biometric data (wire to existing Convex exports)
  const vault = useQuery(api.queries.getBioVaultBySession, { sessionId });

  // Build biometric inputs from BioVault summary fields
  const biometricInputs = useMemo<BiometricInputs | null>(() => {
    if (!vault) return null;
    return {
      hrv: vault.hrvCurrent ?? 52,
      heartRate: 68,
      sleepHours: vault.sleepHours ?? 7.2,
      sleepScore: vault.sleepScore ?? 72,
      sleepDeepPct: vault.sleepDeepPct ?? 16,
      sleepRemPct: vault.sleepRemPct ?? 22,
      recovery: 62,
      strain: 8,
      stress: 38,
      bodyBattery: 55,
      spo2: 97,
      readiness: 65,
      steps: 6500,
      respiratoryRate: 15,
      skinTemp: 36.5,
      crp: vault?.crp ?? undefined,
      hba1c: vault?.hba1c ?? undefined,
      vitaminD: vault?.vitaminD ?? undefined,
      cortisol: undefined,
    };
  }, [vault]);

  // Run BioIntelligence engine
  const report = useMemo<BioIntelligenceReport | null>(() => {
    if (!biometricInputs) return null;
    try {
      return runBioIntelligence(biometricInputs);
    } catch {
      return null;
    }
  }, [biometricInputs]);

  // Filter interventions
  const filteredInterventions = useMemo(() => {
    if (!report) return [];
    let interventions = report.interventions;
    if (activeFilter !== 'all') {
      interventions = interventions.filter(i => i.category === activeFilter);
    }
    return interventions.slice(0, maxCards);
  }, [report, activeFilter, maxCards]);

  // Category counts for filter tabs
  const categoryCounts = useMemo(() => {
    if (!report) return {};
    const counts: Record<string, number> = {};
    for (const i of report.interventions) {
      counts[i.category] = (counts[i.category] || 0) + 1;
    }
    return counts;
  }, [report]);

  const highUrgencyCount = useMemo(() => {
    if (!report) return 0;
    return report.interventions.filter(i => i.urgency === 'critical' || i.urgency === 'high').length;
  }, [report]);

  if (!report || !biometricInputs) {
    return (
      <div className="rounded-2xl p-6 flex items-center justify-center" style={{ background: WARM.cardBg, border: `1px solid ${WARM.border}` }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${WARM.accent} transparent ${WARM.accent} ${WARM.accent}` }} />
          <span className="text-xs font-mono" style={{ color: WARM.muted }}>Scanning biological markers...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Inline Keyframes */}
      <style>{`
        @keyframes apePulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes apePulseStrip { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes apeFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes apeGlow0 { 0%, 100% { box-shadow: 0 0 0 rgba(175,130,255,0); } 50% { box-shadow: 0 0 20px rgba(175,130,255,0.08); } }
        @keyframes apeGlow1 { 0%, 100% { box-shadow: 0 0 0 rgba(0,229,255,0); } 50% { box-shadow: 0 0 20px rgba(0,229,255,0.08); } }
        @keyframes apeGlow2 { 0%, 100% { box-shadow: 0 0 0 rgba(124,182,142,0); } 50% { box-shadow: 0 0 20px rgba(124,182,142,0.08); } }
      `}</style>

      {/* Header */}
      <div className="rounded-2xl px-4 py-3.5" style={{ background: WARM.cardBg, border: `1px solid ${WARM.border}` }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
              style={{ background: 'rgba(175,130,255,0.1)', border: '1px solid rgba(175,130,255,0.2)' }}>
              ⚗️
            </div>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: WARM.text }}>Advanced Protocol Engine</h2>
              <p className="text-[9px] font-mono" style={{ color: WARM.muted }}>
                Peptides · Nootropics · Hormonal Optimization
              </p>
            </div>
          </div>
          {highUrgencyCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(212,132,122,0.1)', border: '1px solid rgba(212,132,122,0.2)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{
                background: WARM.red,
                animation: 'apePulse 1.5s ease-in-out infinite',
              }} />
              <span className="text-[9px] font-mono font-bold" style={{ color: WARM.red }}>
                {highUrgencyCount} HIGH PRIORITY
              </span>
            </div>
          )}
        </div>

        {/* Executive Summary */}
        <p className="text-[11px] leading-relaxed" style={{ color: WARM.muted }}>
          {report.executiveSummary}
        </p>

        {/* Today's Priorities */}
        {report.todayPriorities.length > 0 && (
          <div className="mt-2.5 space-y-1">
            <div className="text-[8px] font-mono font-bold tracking-[0.12em]" style={{ color: WARM.accent }}>
              TODAY&apos;S PRIORITIES
            </div>
            {report.todayPriorities.map((p, i) => (
              <div key={i} className="text-[10px] leading-snug" style={{ color: WARM.text }}>
                {p}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inflammation Scanner */}
      <InflammationScanner
        crp={vault?.crp ?? null}
        recovery={biometricInputs.recovery}
        hrv={biometricInputs.hrv}
      />

      {/* System Status (collapsible) */}
      <button
        onClick={() => setShowSystems(!showSystems)}
        className="w-full rounded-2xl px-4 py-2.5 flex items-center justify-between"
        style={{ background: WARM.cardBg, border: `1px solid ${WARM.border}` }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono font-bold tracking-[0.12em]" style={{ color: WARM.accent }}>
            BIOLOGICAL SYSTEMS ({report.state.systems.length})
          </span>
          <span className="text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded"
            style={{
              background: `${getStatusColor(report.state.systems[0]?.status || 'adequate')}15`,
              color: getStatusColor(report.state.systems[0]?.status || 'adequate'),
            }}>
            COMPOSITE: {report.state.compositeScore}%
          </span>
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
          style={{ transform: showSystems ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s' }}>
          <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke={WARM.muted} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {showSystems && (
        <div className="space-y-1.5" style={{ animation: 'apeFadeIn 0.3s ease-out' }}>
          {report.state.systems.map((sys) => (
            <SystemMiniCard key={sys.system} system={sys} />
          ))}
        </div>
      )}

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {[
          { key: 'all', label: 'ALL', count: report.interventions.length },
          { key: 'peptide', label: '💉 PEPTIDES', count: categoryCounts.peptide || 0 },
          { key: 'supplement', label: '💊 SUPPLEMENTS', count: categoryCounts.supplement || 0 },
          { key: 'holistic', label: '🧘 HOLISTIC', count: categoryCounts.holistic || 0 },
        ].filter(t => t.count > 0 || t.key === 'all').map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className="flex-shrink-0 px-3 py-1.5 rounded-full text-[9px] font-mono font-bold tracking-[0.08em] transition-all duration-200"
            style={{
              background: activeFilter === tab.key ? `${WARM.accent}15` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${activeFilter === tab.key ? `${WARM.accent}30` : WARM.border}`,
              color: activeFilter === tab.key ? WARM.accent : WARM.muted,
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1 opacity-60">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Research Insight Cards */}
      <div className="space-y-2.5">
        {filteredInterventions.length === 0 ? (
          <div className="rounded-2xl px-4 py-8 text-center" style={{ background: WARM.cardBg, border: `1px solid ${WARM.border}` }}>
            <span className="text-2xl mb-2 block">✅</span>
            <p className="text-xs font-mono" style={{ color: WARM.green }}>
              No interventions needed for this category
            </p>
            <p className="text-[10px] font-mono mt-1" style={{ color: WARM.muted }}>
              Your markers are within optimal range
            </p>
          </div>
        ) : (
          filteredInterventions.map((intervention, i) => (
            <ResearchInsightCard key={intervention.id} intervention={intervention} index={i} />
          ))
        )}
      </div>

      {/* Risk Flags */}
      {report.state.riskFlags.length > 0 && (
        <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(212,132,122,0.04)', border: '1px solid rgba(212,132,122,0.15)' }}>
          <div className="text-[8px] font-mono font-bold tracking-[0.12em] mb-2" style={{ color: WARM.red }}>
            ⚠️ ACTIVE RISK FLAGS
          </div>
          <div className="space-y-1.5">
            {report.state.riskFlags.map((flag) => (
              <div key={flag.id} className="flex items-start gap-2">
                <span className="text-xs flex-shrink-0">{flag.icon}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-mono font-bold" style={{
                    color: flag.severity === 'critical' ? WARM.red : flag.severity === 'alert' ? WARM.amber : WARM.accent,
                  }}>
                    {flag.severity.toUpperCase()}
                  </span>
                  <span className="text-[10px] ml-1.5" style={{ color: WARM.text }}>{flag.message}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${WARM.border}` }}>
        <p className="text-[8px] font-mono leading-relaxed" style={{ color: WARM.muted }}>
          ⚕️ Research insights are generated from peer-reviewed literature and your biometric data.
          Peptide and hormonal protocols require medical supervision. Consult a licensed physician
          before starting any new supplement, peptide, or hormonal optimization protocol.
        </p>
      </div>
    </div>
  );
}
