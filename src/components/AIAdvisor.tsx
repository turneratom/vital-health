import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBiometricSync } from '@/hooks/useBiometricSync';
import {
  runIntelligenceEngine,
  getCategoryLabel,
  getUrgencyLabel,
  getSystemLabel,
  type ProtocolRecommendation,
  type BiometricInputs,
  type ProtocolCategory,
} from '@/lib/IntelligenceEngine';

/* ══════════════════════════════════════════════════════════════════
   AI ADVISOR — Intelligence Engine UI Widget
   Displays ranked protocol recommendations with scientific rationale,
   dosing, timing, citations, and synergy maps.
   ══════════════════════════════════════════════════════════════════ */

const CATEGORY_ICONS: Record<ProtocolCategory, string> = {
  peptide: '\uD83E\uDDEC',
  holistic: '\uD83E\uDDD8',
  supplement: '\uD83D\uDC8A',
};

const URGENCY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  critical: { bg: 'rgba(255,59,48,0.08)', border: 'rgba(255,59,48,0.25)', text: '#FF3B30', dot: '#FF3B30' },
  high: { bg: 'rgba(255,159,10,0.08)', border: 'rgba(255,159,10,0.2)', text: '#FF9F0A', dot: '#FF9F0A' },
  moderate: { bg: 'rgba(0,240,255,0.05)', border: 'rgba(0,240,255,0.12)', text: '#00F0FF', dot: '#00F0FF' },
  advisory: { bg: 'rgba(255,255,255,0.02)', border: 'rgba(255,255,255,0.06)', text: 'rgba(255,255,255,0.5)', dot: 'rgba(255,255,255,0.3)' },
};

/* ── Expanded Card Detail ── */
function RecommendationDetail({ rec, onClose }: { rec: ProtocolRecommendation; onClose: () => void }) {
  const uc = URGENCY_COLORS[rec.urgency] || URGENCY_COLORS.advisory;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-2xl overflow-hidden relative"
      style={{
        background: 'linear-gradient(135deg, rgba(10,12,18,0.98) 0%, rgba(8,8,14,0.99) 100%)',
        border: `1px solid ${rec.color}20`,
        boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 30px ${rec.color}08`,
      }}
    >
      {/* Ambient glow */}
      <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${rec.color}08 0%, transparent 70%)` }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{ background: `${rec.color}12`, border: `1px solid ${rec.color}20`, boxShadow: `0 0 16px ${rec.color}15` }}>
              <span className="text-xl">{rec.icon}</span>
            </div>
            <div>
              <h3 className="font-semibold text-[14px] leading-tight" style={{ color: 'rgba(224,224,224,0.95)', letterSpacing: '-0.01em' }}>
                {rec.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-[8px] tracking-widest px-1.5 py-0.5 rounded"
                  style={{ background: `${rec.color}15`, color: `${rec.color}BB` }}>
                  {getCategoryLabel(rec.category)}
                </span>
                <span className="font-mono text-[8px] tracking-widest px-1.5 py-0.5 rounded"
                  style={{ background: uc.bg, color: uc.text, border: `1px solid ${uc.border}` }}>
                  {getUrgencyLabel(rec.urgency)}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Confidence + System Target */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full" style={{ width: `${rec.confidence}%`, background: rec.color, boxShadow: `0 0 6px ${rec.color}60` }} />
            </div>
            <span className="font-mono text-[9px] tabular-nums" style={{ color: `${rec.color}AA` }}>{rec.confidence}%</span>
          </div>
          <span className="font-mono text-[8px] tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
            \u2192 {getSystemLabel(rec.systemTarget)}
          </span>
        </div>

        {/* Triggers */}
        <div className="mb-4">
          <div className="font-mono text-[8px] tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>BIOMETRIC TRIGGERS</div>
          <div className="flex flex-wrap gap-1.5">
            {rec.triggers.map((t, i) => (
              <span key={i} className="text-[10px] px-2 py-1 rounded-md font-mono"
                style={{ background: `${uc.dot}08`, color: `${uc.dot}CC`, border: `1px solid ${uc.dot}15` }}>
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Scientific Rationale */}
        <div className="mb-4 rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2 mb-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={rec.color} strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.7 }}>
              <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4" />
            </svg>
            <span className="font-mono text-[8px] tracking-widest" style={{ color: `${rec.color}88` }}>SCIENTIFIC RATIONALE</span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(200,210,220,0.65)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            {rec.rationale}
          </p>
        </div>

        {/* Dosing + Timing */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="font-mono text-[7px] tracking-widest mb-1.5" style={{ color: 'rgba(0,240,255,0.4)' }}>DOSING</div>
            <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(200,210,220,0.6)' }}>{rec.dosing}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="font-mono text-[7px] tracking-widest mb-1.5" style={{ color: 'rgba(0,240,255,0.4)' }}>TIMING</div>
            <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(200,210,220,0.6)' }}>{rec.timing}</p>
          </div>
        </div>

        {/* Synergies */}
        <div className="mb-4">
          <div className="font-mono text-[8px] tracking-widest mb-2" style={{ color: 'rgba(175,130,255,0.5)' }}>SYNERGISTIC COMPOUNDS</div>
          <div className="flex flex-col gap-1">
            {rec.synergies.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full" style={{ background: '#AF82FF', boxShadow: '0 0 4px rgba(175,130,255,0.5)' }} />
                <span className="text-[10px]" style={{ color: 'rgba(175,130,255,0.6)' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cautions */}
        {rec.cautions.length > 0 && (
          <div className="mb-4 rounded-xl p-3" style={{ background: 'rgba(255,59,48,0.04)', border: '1px solid rgba(255,59,48,0.08)' }}>
            <div className="font-mono text-[8px] tracking-widest mb-2" style={{ color: 'rgba(255,59,48,0.5)' }}>CAUTIONS</div>
            {rec.cautions.map((c, i) => (
              <div key={i} className="flex items-start gap-2 mb-1 last:mb-0">
                <span className="text-[9px] mt-0.5" style={{ color: 'rgba(255,59,48,0.4)' }}>\u26A0</span>
                <span className="text-[10px]" style={{ color: 'rgba(255,120,100,0.55)' }}>{c}</span>
              </div>
            ))}
          </div>
        )}

        {/* Expected Outcome */}
        <div className="mb-4 rounded-xl p-3" style={{ background: `${rec.color}06`, border: `1px solid ${rec.color}10` }}>
          <div className="font-mono text-[8px] tracking-widest mb-1.5" style={{ color: `${rec.color}55` }}>EXPECTED OUTCOME</div>
          <p className="text-[10px] leading-relaxed" style={{ color: `${rec.color}88` }}>{rec.expectedOutcome}</p>
        </div>

        {/* Citations */}
        {rec.citations.length > 0 && (
          <div>
            <div className="font-mono text-[7px] tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.2)' }}>REFERENCES</div>
            {rec.citations.map((c, i) => (
              <div key={i} className="mb-1.5 last:mb-0">
                <p className="text-[9px] leading-snug" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {c.authors} ({c.year}). <em>{c.title}</em>. {c.journal}.
                  {c.doi && <span style={{ color: 'rgba(0,240,255,0.3)' }}> doi:{c.doi}</span>}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Compact Card ── */
function RecommendationCard({ rec, index, onExpand }: { rec: ProtocolRecommendation; index: number; onExpand: () => void }) {
  const uc = URGENCY_COLORS[rec.urgency] || URGENCY_COLORS.advisory;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.35, delay: index * 0.08, ease: [0.4, 0, 0.2, 1] }}
      onClick={onExpand}
      className="w-full text-left relative rounded-2xl px-4 py-3.5 overflow-hidden group active:scale-[0.98] transition-transform duration-150"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${rec.color}12`,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Left accent */}
      <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full"
        style={{ background: `linear-gradient(180deg, ${rec.color}, ${rec.color}33)`, boxShadow: `0 0 8px ${rec.color}40` }} />

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${rec.color}10`, border: `1px solid ${rec.color}18`, boxShadow: `0 0 10px ${rec.color}12` }}>
          <span className="text-lg">{rec.icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          {/* Tags row */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[7.5px] tracking-widest" style={{ color: `${rec.color}77` }}>
              {getCategoryLabel(rec.category)}
            </span>
            <div className="w-1 h-1 rounded-full" style={{ background: uc.dot, boxShadow: `0 0 4px ${uc.dot}`, animation: rec.urgency === 'critical' ? 'statusDotPulse 1.5s ease-in-out infinite' : 'none' }} />
            <span className="font-mono text-[7.5px] tracking-widest" style={{ color: uc.text }}>
              {getUrgencyLabel(rec.urgency)}
            </span>
            {/* Confidence */}
            <span className="font-mono text-[8px] tabular-nums ml-auto" style={{ color: `${rec.color}55` }}>
              {rec.confidence}%
            </span>
          </div>

          {/* Name */}
          <h4 className="font-semibold text-[12.5px] leading-snug mb-0.5"
            style={{ color: 'rgba(224,224,224,0.9)', letterSpacing: '-0.01em' }}>
            {rec.name}
          </h4>

          {/* Headline */}
          <p className="text-[10.5px] leading-relaxed" style={{ color: 'rgba(160,180,200,0.5)' }}>
            {rec.headline}
          </p>

          {/* Trigger pills */}
          <div className="flex flex-wrap gap-1 mt-2">
            {rec.triggers.slice(0, 2).map((t, i) => (
              <span key={i} className="text-[8.5px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: `${uc.dot}08`, color: `${uc.dot}88` }}>
                {t}
              </span>
            ))}
            {rec.triggers.length > 2 && (
              <span className="text-[8.5px] px-1.5 py-0.5 rounded font-mono"
                style={{ color: 'rgba(255,255,255,0.25)' }}>
                +{rec.triggers.length - 2} more
              </span>
            )}
          </div>
        </div>

        {/* Expand arrow */}
        <div className="shrink-0 mt-3 opacity-30 group-hover:opacity-60 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: rec.color }}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </div>
    </motion.button>
  );
}

/* ── Category Filter Tabs ── */
function CategoryFilter({ active, onChange }: { active: ProtocolCategory | 'all'; onChange: (c: ProtocolCategory | 'all') => void }) {
  const tabs: { id: ProtocolCategory | 'all'; label: string; icon: string }[] = [
    { id: 'all', label: 'ALL', icon: '\u26A1' },
    { id: 'peptide', label: 'PEPTIDES', icon: '\uD83E\uDDEC' },
    { id: 'supplement', label: 'SUPPS', icon: '\uD83D\uDC8A' },
    { id: 'holistic', label: 'HOLISTIC', icon: '\uD83E\uDDD8' },
  ];

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-mono text-[8px] tracking-widest transition-all duration-200"
          style={{
            background: active === t.id ? 'rgba(0,240,255,0.08)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${active === t.id ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.04)'}`,
            color: active === t.id ? 'rgba(0,240,255,0.8)' : 'rgba(255,255,255,0.3)',
          }}
        >
          <span className="text-[10px]">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN WIDGET
   ══════════════════════════════════════════════════════════════════ */

interface AIAdvisorProps {
  /** Optional override for biometric inputs (e.g. from bioVault lab data) */
  cortisol?: number | null;
  crp?: number | null;
  vitaminD?: number | null;
  ferritin?: number | null;
  hba1c?: number | null;
}

export function AIAdvisor({ cortisol, crp, vitaminD, ferritin, hba1c }: AIAdvisorProps) {
  const { vitals } = useBiometricSync();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ProtocolCategory | 'all'>('all');

  // Build biometric inputs from synced vitals + optional lab data
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
    cortisol: cortisol ?? undefined,
    crp: crp ?? undefined,
    vitaminD: vitaminD ?? undefined,
    ferritin: ferritin ?? undefined,
    hba1c: hba1c ?? undefined,
  }), [vitals, cortisol, crp, vitaminD, ferritin, hba1c]);

  // Run engine
  const allRecommendations = useMemo(() => runIntelligenceEngine(inputs), [inputs]);

  // Filter by category
  const recommendations = useMemo(() => {
    if (categoryFilter === 'all') return allRecommendations;
    return allRecommendations.filter(r => r.category === categoryFilter);
  }, [allRecommendations, categoryFilter]);

  const expandedRec = useMemo(() => recommendations.find(r => r.id === expandedId), [recommendations, expandedId]);

  const handleExpand = useCallback((id: string) => setExpandedId(prev => prev === id ? null : id), []);
  const handleClose = useCallback(() => setExpandedId(null), []);

  if (allRecommendations.length === 0) return null;

  // Count by urgency
  const criticalCount = allRecommendations.filter(r => r.urgency === 'critical' || r.urgency === 'high').length;

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-0.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center relative"
          style={{ background: 'rgba(175,130,255,0.08)', border: '1px solid rgba(175,130,255,0.15)', boxShadow: '0 0 12px rgba(175,130,255,0.1)' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(175,130,255,0.8)" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
          {criticalCount > 0 && (
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center"
              style={{ background: '#FF3B30', boxShadow: '0 0 6px rgba(255,59,48,0.6)', animation: 'statusDotPulse 2s ease-in-out infinite' }}>
              <span className="text-[7px] font-bold text-white">{criticalCount}</span>
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-[13px] tracking-tight" style={{ color: 'rgba(224,224,224,0.9)', letterSpacing: '-0.01em' }}>
            AI Protocol Advisor
          </span>
          <span className="text-[10px]" style={{ color: 'rgba(175,130,255,0.4)' }}>
            {allRecommendations.length} protocol{allRecommendations.length !== 1 ? 's' : ''} matched to your biometrics
          </span>
        </div>
      </div>

      {/* Category Filter */}
      <CategoryFilter active={categoryFilter} onChange={setCategoryFilter} />

      {/* Cards */}
      <AnimatePresence mode="popLayout">
        {expandedRec ? (
          <RecommendationDetail key={`detail-${expandedRec.id}`} rec={expandedRec} onClose={handleClose} />
        ) : (
          recommendations.slice(0, 5).map((rec, i) => (
            <RecommendationCard key={rec.id} rec={rec} index={i} onExpand={() => handleExpand(rec.id)} />
          ))
        )}
      </AnimatePresence>

      {/* Disclaimer */}
      <div className="px-1 mt-1">
        <p className="text-[8px] font-mono leading-relaxed" style={{ color: 'rgba(255,255,255,0.15)' }}>
          ADVISORY ONLY \u2014 Not medical advice. Consult a licensed physician before starting any peptide, supplement, or protocol regimen. Recommendations are generated from biometric pattern matching, not clinical diagnosis.
        </p>
      </div>
    </div>
  );
}

export default AIAdvisor;
