import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { getTwinSessionId } from '@/lib/twinSession';
import { usePerformanceScore } from '../../features/dashboard/hooks/usePerformanceScore';
import { generateArchitectResponse, buildBioContext } from '../../lib/useAI';
import type { BioSnapshot } from '../../lib/useAI';
import type { ProtocolSupplement, ProtocolIntervention, DynamicTarget, SupplementPriority } from '../../../convex/supplementLogic';

/* ═══════════════════════════════════════════════════════════════
   PROTOCOL ENGINE — Grid-X Command Center
   Real-time personalized supplement stacks, interventions,
   and dynamic targets driven by Bio-Vault + System Vitals.
   ═══════════════════════════════════════════════════════════════ */

/* ── Priority badge colors ── */
const PRIORITY_CONFIG: Record<SupplementPriority, { color: string; glow: string; label: string }> = {
  critical: { color: '#ff4444', glow: 'rgba(255,68,68,0.4)', label: 'CRITICAL' },
  recommended: { color: '#00ccff', glow: 'rgba(0,204,255,0.3)', label: 'RECOMMENDED' },
  optional: { color: 'rgba(0,240,255,0.35)', glow: 'rgba(0,240,255,0.15)', label: 'OPTIONAL' },
};

/* ── Timing badge colors ── */
const TIMING_COLORS: Record<string, string> = {
  morning: '#00ffaa',
  afternoon: '#00ccff',
  evening: '#8866ff',
  'with-food': '#ffaa00',
  'empty-stomach': '#ff6b6b',
};

/* ── Category icons ── */
const CATEGORY_ICONS: Record<string, string> = {
  'blood-marker': '🩸',
  genetic: '🧬',
  recovery: '🔄',
  performance: '⚡',
  sleep: '🌙',
  thermal: '🌡️',
  breathwork: '🌬️',
  light: '🔴',
  movement: '🚶',
};

/* ── Focus mode tabs ── */
type FocusMode = 'protocol' | 'interventions' | 'targets';

const ProtocolsView: React.FC = () => {
  const SESSION_ID = getTwinSessionId();
  const [mounted, setMounted] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [focusMode, setFocusMode] = useState<FocusMode>('protocol');
  const [winBurst, setWinBurst] = useState<string | null>(null);
  const [showCoachInsight, setShowCoachInsight] = useState(false);
  const [coachMessage, setCoachMessage] = useState('');

  useEffect(() => { setMounted(true); }, []);

  // Load today's checked state from localStorage
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const saved = localStorage.getItem(`vive-protocol-${today}`);
    if (saved) {
      try { setChecked(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  // Save checked state
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem(`vive-protocol-${today}`, JSON.stringify(checked));
  }, [checked]);

  // ── Real Convex data ──
  const perf = usePerformanceScore(SESSION_ID);
  const bioVault = useQuery(api.queries.getBioVaultBySession, { sessionId: SESSION_ID });
  const protocolLogs = useQuery(api.queries.getTodayProtocolLogs, { sessionId: SESSION_ID });

  // ── Generate personalized protocol from Bio-Vault + vitals ──
  const dailyProtocol = useQuery(api.queries.getDailyProtocol, {
    sessionId: SESSION_ID,
    hrv: perf.currentHrv > 0 ? perf.currentHrv : undefined,
    hrvAvg7d: perf.hrvHistory7d.length > 0
      ? Math.round(perf.hrvHistory7d.reduce((s, v) => s + v, 0) / perf.hrvHistory7d.length)
      : undefined,
    recovery: perf.recovery > 0 ? perf.recovery : undefined,
  });

  const supplements = dailyProtocol?.supplements ?? [];
  const interventions = dailyProtocol?.interventions ?? [];
  const dynamicTargets = dailyProtocol?.dynamicTargets ?? [];
  const dataCompleteness = dailyProtocol?.dataCompleteness ?? 0;
  const protocolTier = dailyProtocol?.protocolTier ?? 'baseline';

  // ── Adherence calculation ──
  const totalItems = supplements.length + interventions.length;
  const completedItems = Object.values(checked).filter(Boolean).length;
  const adherencePct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // ── Critical count ──
  const criticalCount = supplements.filter(s => s.priority === 'critical').length;
  const criticalCompleted = supplements.filter(s => s.priority === 'critical' && checked[s.id]).length;

  // ── Toggle with win burst ──
  const toggle = useCallback((id: string) => {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] };
      if (!prev[id]) {
        setWinBurst(id);
        setTimeout(() => setWinBurst(null), 600);
      }
      return next;
    });
  }, []);

  // ── AI Coach insight ──
  const generateCoachInsight = useCallback(() => {
    const snapshot: BioSnapshot = {
      vitalityScore: perf.eliteScore,
      fuelingPoints: perf.fuelingPoints,
      movementPoints: perf.movementPoints,
      hrvPoints: perf.hrvPoints,
      basePoints: perf.basePoints,
      vitaminD: bioVault?.vitaminD ?? undefined,
      testosteroneTotal: bioVault?.testosteroneTotal ?? undefined,
      testosteroneFree: bioVault?.testosteroneFree ?? undefined,
      ferritin: bioVault?.ferritin ?? undefined,
      crp: bioVault?.crp ?? undefined,
      hba1c: bioVault?.hba1c ?? undefined,
      mthfrVariant: bioVault?.mthfrVariant ?? false,
      apoe4: bioVault?.apoe4 ?? false,
      caffeineSensitivity: bioVault?.caffeineSensitivity ?? false,
      hrv: perf.currentHrv,
      recovery: perf.recovery,
      strain: perf.stress * 0.21,
      todayCalories: perf.totalCaloriesIn,
      todayProtein: perf.totalProtein,
      preferredProteins: bioVault?.preferredProteins ?? '',
      dietaryRestrictions: bioVault?.dietaryRestrictions ?? '',
    };
    const { text } = generateArchitectResponse('What should I focus on in my protocol today?', snapshot);
    setCoachMessage(text);
    setShowCoachInsight(true);
  }, [perf, bioVault]);

  // ── Group supplements by timing ──
  const groupedSupplements = useMemo(() => {
    const groups: Record<string, ProtocolSupplement[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      'with-food': [],
      'empty-stomach': [],
    };
    for (const s of supplements) {
      if (groups[s.timing]) groups[s.timing].push(s);
      else groups['morning'].push(s);
    }
    return Object.entries(groups).filter(([, items]) => items.length > 0);
  }, [supplements]);

  return (
    <div
      className="font-mono px-4 pb-8 max-w-[640px] mx-auto"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
        transition: 'all 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* ═══ HEADER ═══ */}
      <div className="mb-5 pt-2">
        <div className="flex items-center gap-2 mb-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: adherencePct === 100 ? '#00ffaa' : '#00ccff',
              boxShadow: `0 0 8px ${adherencePct === 100 ? 'rgba(0,255,170,0.6)' : 'rgba(0,204,255,0.6)'}`,
              animation: 'statusDotPulse 2s ease-in-out infinite',
            }}
          />
          <span className="typo-meta text-[10px]" style={{ color: adherencePct === 100 ? '#00ffaa' : '#00ccff' }}>
            {adherencePct === 100 ? 'ALL_PROTOCOLS_COMPLETE' : 'PROTOCOL_ENGINE_ACTIVE'}
          </span>
          <span className="typo-meta text-[9px] ml-auto" style={{ color: 'rgba(0,240,255,0.3)' }}>
            {protocolTier === 'personalized' ? '🧬 PERSONALIZED' : '📊 BASELINE'}
          </span>
        </div>
        <h1 className="typo-header text-2xl text-[#e0e0e0] mb-1" style={{ textTransform: 'none', letterSpacing: '-0.03em' }}>
          Protocol Engine
        </h1>
        <p className="typo-sublabel text-xs" style={{ color: 'rgba(0,240,255,0.35)' }}>
          {protocolTier === 'personalized'
            ? `Calibrated from ${dataCompleteness}% Bio-Vault data + live vitals`
            : 'Baseline protocol — add blood panels for precision dosing'}
        </p>
      </div>

      {/* ═══ ADHERENCE + ELITE SCORE STRIP ═══ */}
      <div
        className="rounded-xl p-4 mb-4"
        style={{
          background: 'rgba(6,8,12,0.6)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.06)',
          animation: 'cardSlideUp 0.5s ease both',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00ccff', boxShadow: '0 0 6px rgba(0,204,255,0.6)', animation: 'statusDotPulse 2.5s ease-in-out infinite' }} />
            <span className="typo-meta text-[10px]" style={{ color: '#00ccff', letterSpacing: '0.1em' }}>PROTOCOL ADHERENCE</span>
          </div>
          <div className="flex items-center gap-3">
            {criticalCount > 0 && (
              <span className="typo-meta text-[9px] px-2 py-0.5 rounded-full" style={{
                background: criticalCompleted === criticalCount ? 'rgba(0,255,170,0.1)' : 'rgba(255,68,68,0.1)',
                color: criticalCompleted === criticalCount ? '#00ffaa' : '#ff4444',
                border: `1px solid ${criticalCompleted === criticalCount ? 'rgba(0,255,170,0.2)' : 'rgba(255,68,68,0.2)'}`,
              }}>
                {criticalCompleted === criticalCount ? '✓' : '!'} {criticalCompleted}/{criticalCount} CRITICAL
              </span>
            )}
            <span className="typo-data text-[11px]" style={{ color: 'rgba(0,240,255,0.4)' }}>
              {completedItems}/{totalItems}
            </span>
          </div>
        </div>

        {/* Adherence bar */}
        <div className="flex items-baseline gap-3 mb-3">
          <span className="typo-data text-4xl" style={{
            color: adherencePct === 100 ? '#00ffaa' : adherencePct >= 50 ? '#00ccff' : '#ffaa00',
            filter: `drop-shadow(0 0 10px ${adherencePct === 100 ? 'rgba(0,255,170,0.4)' : 'rgba(0,204,255,0.4)'})`,
          }}>{adherencePct}%</span>
          <span className="typo-label text-[10px]" style={{ color: 'rgba(0,240,255,0.4)' }}>ADHERENCE</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="typo-data text-[14px]" style={{ color: '#00ccff', filter: 'drop-shadow(0 0 6px rgba(0,204,255,0.3))' }}>{perf.eliteScore}</span>
            <span className="typo-meta text-[8px]" style={{ color: 'rgba(0,240,255,0.3)' }}>ELITE</span>
          </div>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,240,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-[0.8s]"
            style={{
              width: `${adherencePct}%`,
              background: adherencePct === 100 ? '#00ffaa' : 'linear-gradient(90deg, #00ffaa, #00ccff)',
              boxShadow: `0 0 8px ${adherencePct === 100 ? 'rgba(0,255,170,0.4)' : 'rgba(0,204,255,0.3)'}`,
            }}
          />
        </div>

        {/* Quick vitals strip */}
        <div className="grid grid-cols-4 gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,240,255,0.06)' }}>
          {[
            { label: 'HRV', value: `${perf.currentHrv}`, unit: 'ms', color: '#00ccff' },
            { label: 'RECOVERY', value: `${perf.recovery}`, unit: '%', color: perf.recovery >= 70 ? '#00ffaa' : '#ffaa00' },
            { label: 'HR', value: `${perf.hr}`, unit: 'bpm', color: '#ff6b6b' },
            { label: 'STRESS', value: `${perf.stress}`, unit: '', color: perf.stress < 40 ? '#00ffaa' : '#ffaa00' },
          ].map(v => (
            <div key={v.label} className="text-center">
              <div className="typo-data text-[14px]" style={{ color: v.color }}>{v.value}<span className="text-[8px] ml-0.5" style={{ color: 'rgba(0,240,255,0.3)' }}>{v.unit}</span></div>
              <div className="typo-meta text-[7px]" style={{ color: 'rgba(0,240,255,0.25)', letterSpacing: '0.1em' }}>{v.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ FOCUS MODE TABS ═══ */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,240,255,0.06)' }}>
        {([
          { key: 'protocol' as FocusMode, label: 'SUPPLEMENTS', count: supplements.length },
          { key: 'interventions' as FocusMode, label: 'INTERVENTIONS', count: interventions.length },
          { key: 'targets' as FocusMode, label: 'TARGETS', count: dynamicTargets.length },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFocusMode(tab.key)}
            className="flex-1 py-2 px-2 rounded-md transition-all duration-200 text-center"
            style={{
              background: focusMode === tab.key ? 'rgba(0,240,255,0.08)' : 'transparent',
              border: focusMode === tab.key ? '1px solid rgba(0,240,255,0.15)' : '1px solid transparent',
            }}
          >
            <span className="typo-meta text-[9px] block" style={{
              color: focusMode === tab.key ? '#00ccff' : 'rgba(0,240,255,0.3)',
              letterSpacing: '0.08em',
            }}>{tab.label}</span>
            <span className="typo-data text-[11px] block mt-0.5" style={{
              color: focusMode === tab.key ? '#e0e0e0' : 'rgba(0,240,255,0.2)',
            }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ═══ SUPPLEMENTS TAB ═══ */}
      {focusMode === 'protocol' && (
        <div>
          {groupedSupplements.map(([timing, items], gi) => {
            const timingDone = items.every(s => checked[s.id]);
            return (
              <div
                key={timing}
                className="rounded-xl p-4 mb-3"
                style={{
                  background: 'rgba(6,8,12,0.6)',
                  backdropFilter: 'blur(24px)',
                  border: `1px solid ${timingDone ? 'rgba(0,255,170,0.12)' : 'rgba(255,255,255,0.06)'}`,
                  borderLeftWidth: '2px',
                  borderLeftColor: timingDone ? 'rgba(0,255,170,0.3)' : (TIMING_COLORS[timing] ?? '#00ccff') + '44',
                  animation: `cardSlideUp 0.6s ease both ${0.1 + gi * 0.08}s`,
                }}
              >
                {/* Timing header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-sm transition-all duration-300" style={{
                      background: timingDone ? '#00ffaa' : (TIMING_COLORS[timing] ?? '#00ccff'),
                      boxShadow: timingDone ? '0 0 8px rgba(0,255,170,0.5)' : `0 0 4px ${TIMING_COLORS[timing] ?? '#00ccff'}44`,
                    }} />
                    <span className="typo-meta text-[10px] font-bold" style={{
                      color: timingDone ? '#00ffaa' : (TIMING_COLORS[timing] ?? '#00ccff'),
                      letterSpacing: '0.12em',
                      filter: timingDone ? 'drop-shadow(0 0 4px rgba(0,255,170,0.3))' : 'none',
                    }}>
                      {timingDone ? '\u2713 ' : ''}{timing.toUpperCase().replace('-', ' ')}
                    </span>
                  </div>
                  <span className="typo-data text-[10px]" style={{ color: timingDone ? '#00ffaa' : 'rgba(0,240,255,0.3)' }}>
                    {items.filter(s => checked[s.id]).length}/{items.length}
                  </span>
                </div>

                {/* Supplement items */}
                <div className="flex flex-col gap-1.5">
                  {items.map((supp) => {
                    const isDone = !!checked[supp.id];
                    const isWin = winBurst === supp.id;
                    const pCfg = PRIORITY_CONFIG[supp.priority];
                    return (
                      <div
                        key={supp.id}
                        onClick={() => toggle(supp.id)}
                        className="relative flex items-start gap-3 px-3 py-3 rounded-lg cursor-pointer transition-all duration-300"
                        style={{
                          background: isDone ? 'rgba(0,255,170,0.04)' : 'rgba(0,0,0,0.3)',
                          backdropFilter: 'blur(8px)',
                          border: `1px solid ${isDone ? 'rgba(0,255,170,0.15)' : 'rgba(0,240,255,0.05)'}`,
                          boxShadow: isDone ? '0 0 8px rgba(0,255,170,0.05)' : 'none',
                        }}
                      >
                        {/* Win burst animation */}
                        {isWin && (
                          <div className="absolute inset-0 rounded-lg pointer-events-none" style={{
                            background: 'radial-gradient(circle at center, rgba(0,255,170,0.15) 0%, transparent 70%)',
                            animation: 'protocolWinBurst 0.6s ease-out forwards',
                          }} />
                        )}

                        {/* Checkbox */}
                        <div className="w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-200" style={{
                          border: `2px solid ${isDone ? '#00ffaa' : supp.priority === 'critical' ? 'rgba(255,68,68,0.3)' : 'rgba(0,240,255,0.15)'}`,
                          background: isDone ? '#00ffaa' : 'transparent',
                          boxShadow: isDone ? '0 0 8px rgba(0,255,170,0.3)' : 'none',
                        }}>
                          {isDone && <span className="text-[11px] font-bold" style={{ color: '#000' }}>{'\u2713'}</span>}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[13px]">{supp.icon}</span>
                            <span className="typo-body text-[12px] font-medium transition-all duration-300" style={{
                              color: isDone ? '#00ffaa' : '#e0e0e0',
                              textDecoration: isDone ? 'line-through' : 'none',
                              filter: isDone ? 'drop-shadow(0 0 4px rgba(0,255,170,0.2))' : 'none',
                            }}>
                              {supp.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="typo-data text-[11px]" style={{ color: '#00ccff' }}>{supp.dose}</span>
                            <span className="typo-meta text-[8px] px-1.5 py-0.5 rounded-full" style={{
                              background: `${pCfg.color}15`,
                              color: pCfg.color,
                              border: `1px solid ${pCfg.color}30`,
                            }}>{pCfg.label}</span>
                            <span className="typo-meta text-[8px] px-1.5 py-0.5 rounded-full" style={{
                              background: 'rgba(0,240,255,0.05)',
                              color: 'rgba(0,240,255,0.4)',
                              border: '1px solid rgba(0,240,255,0.08)',
                            }}>{CATEGORY_ICONS[supp.category] ?? '💊'} {supp.category.replace('-', ' ').toUpperCase()}</span>
                          </div>
                          <p className="typo-sublabel text-[10px] leading-relaxed" style={{ color: 'rgba(0,240,255,0.35)' }}>
                            {supp.reason}
                          </p>
                          {supp.linkedMarker && (
                            <div className="mt-1 flex items-center gap-1">
                              <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(0,240,255,0.2)' }} />
                              <span className="typo-meta text-[8px]" style={{ color: 'rgba(0,240,255,0.25)' }}>
                                Linked: {supp.linkedMarker}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {supplements.length === 0 && (
            <div className="rounded-xl p-6 text-center" style={{
              background: 'rgba(6,8,12,0.6)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(0,240,255,0.06)',
            }}>
              <div className="text-2xl mb-2">🧬</div>
              <div className="typo-meta text-[11px]" style={{ color: 'rgba(0,240,255,0.4)' }}>
                Loading protocol engine...
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ INTERVENTIONS TAB ═══ */}
      {focusMode === 'interventions' && (
        <div>
          {interventions.map((intv, i) => {
            const isDone = !!checked[intv.id];
            const isWin = winBurst === intv.id;
            const intensityColor = intv.intensity === 'high' ? '#ff4444' : intv.intensity === 'medium' ? '#ffaa00' : '#00ffaa';
            return (
              <div
                key={intv.id}
                onClick={() => toggle(intv.id)}
                className="relative rounded-xl p-4 mb-3 cursor-pointer transition-all duration-300"
                style={{
                  background: isDone ? 'rgba(0,255,170,0.03)' : 'rgba(6,8,12,0.6)',
                  backdropFilter: 'blur(24px)',
                  border: `1px solid ${isDone ? 'rgba(0,255,170,0.12)' : 'rgba(255,255,255,0.06)'}`,
                  animation: `cardSlideUp 0.6s ease both ${0.1 + i * 0.08}s`,
                }}
              >
                {isWin && (
                  <div className="absolute inset-0 rounded-xl pointer-events-none" style={{
                    background: 'radial-gradient(circle at center, rgba(0,255,170,0.15) 0%, transparent 70%)',
                    animation: 'protocolWinBurst 0.6s ease-out forwards',
                  }} />
                )}

                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <div className="w-[18px] h-[18px] rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-200" style={{
                    border: `2px solid ${isDone ? '#00ffaa' : 'rgba(0,240,255,0.15)'}`,
                    background: isDone ? '#00ffaa' : 'transparent',
                    boxShadow: isDone ? '0 0 8px rgba(0,255,170,0.3)' : 'none',
                  }}>
                    {isDone && <span className="text-[11px] font-bold" style={{ color: '#000' }}>{'\u2713'}</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px]">{intv.icon}</span>
                      <span className="typo-body text-[13px] font-medium" style={{
                        color: isDone ? '#00ffaa' : '#e0e0e0',
                        textDecoration: isDone ? 'line-through' : 'none',
                      }}>{intv.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="typo-data text-[11px]" style={{ color: '#00ccff' }}>{intv.duration}</span>
                      <span className="typo-meta text-[8px] px-1.5 py-0.5 rounded-full" style={{
                        background: `${intensityColor}15`,
                        color: intensityColor,
                        border: `1px solid ${intensityColor}30`,
                      }}>{intv.intensity.toUpperCase()}</span>
                      <span className="typo-meta text-[8px] px-1.5 py-0.5 rounded-full" style={{
                        background: 'rgba(0,240,255,0.05)',
                        color: 'rgba(0,240,255,0.4)',
                        border: '1px solid rgba(0,240,255,0.08)',
                      }}>{CATEGORY_ICONS[intv.category] ?? '🔬'} {intv.category.toUpperCase()}</span>
                      {intv.strainBased && (
                        <span className="typo-meta text-[8px] px-1.5 py-0.5 rounded-full" style={{
                          background: 'rgba(255,170,0,0.08)',
                          color: '#ffaa00',
                          border: '1px solid rgba(255,170,0,0.15)',
                        }}>STRAIN-BASED</span>
                      )}
                    </div>
                    <p className="typo-sublabel text-[10px] leading-relaxed" style={{ color: 'rgba(0,240,255,0.35)' }}>
                      {intv.benefit}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}

          {interventions.length === 0 && (
            <div className="rounded-xl p-6 text-center" style={{
              background: 'rgba(6,8,12,0.6)',
              border: '1px solid rgba(0,240,255,0.06)',
            }}>
              <div className="text-2xl mb-2">🌡️</div>
              <div className="typo-meta text-[11px]" style={{ color: 'rgba(0,240,255,0.4)' }}>
                No interventions prescribed for current vitals
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ DYNAMIC TARGETS TAB ═══ */}
      {focusMode === 'targets' && (
        <div>
          {dynamicTargets.map((target, i) => (
            <div
              key={target.id}
              className="rounded-xl p-4 mb-3"
              style={{
                background: 'rgba(6,8,12,0.6)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderLeftWidth: '2px',
                borderLeftColor: `${target.color}44`,
                animation: `cardSlideUp 0.6s ease both ${0.1 + i * 0.08}s`,
              }}
            >
              <div className="flex items-start gap-3">
                <div className="text-[20px] mt-0.5">{target.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="typo-meta text-[10px]" style={{ color: target.color, letterSpacing: '0.08em' }}>
                      {target.label.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="typo-data text-[24px]" style={{
                      color: target.color,
                      filter: `drop-shadow(0 0 8px ${target.color}44)`,
                    }}>{target.value}</span>
                    <span className="typo-meta text-[10px]" style={{ color: 'rgba(0,240,255,0.3)' }}>{target.unit}</span>
                  </div>
                  <p className="typo-sublabel text-[10px] leading-relaxed mb-1" style={{ color: 'rgba(0,240,255,0.4)' }}>
                    {target.description}
                  </p>
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(0,240,255,0.15)' }} />
                    <span className="typo-meta text-[8px]" style={{ color: 'rgba(0,240,255,0.2)' }}>
                      Based on: {target.basedOn}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ AI COACH INSIGHT CARD ═══ */}
      <div
        className="rounded-xl p-4 mb-3 mt-1 cursor-pointer transition-all duration-300"
        onClick={generateCoachInsight}
        style={{
          background: showCoachInsight ? 'rgba(6,8,12,0.7)' : 'rgba(6,8,12,0.4)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(136,102,255,0.15)',
          borderLeftWidth: '2px',
          borderLeftColor: 'rgba(136,102,255,0.4)',
          animation: 'cardSlideUp 0.7s ease both 0.3s',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#8866ff', boxShadow: '0 0 6px rgba(136,102,255,0.6)', animation: 'statusDotPulse 3s ease-in-out infinite' }} />
          <span className="typo-meta text-[10px]" style={{ color: '#8866ff', letterSpacing: '0.1em' }}>
            CLINICAL PERFORMANCE ARCHITECT
          </span>
          {!showCoachInsight && (
            <span className="typo-meta text-[8px] ml-auto" style={{ color: 'rgba(136,102,255,0.4)' }}>TAP FOR INSIGHT</span>
          )}
        </div>

        {showCoachInsight ? (
          <div>
            <p className="typo-body text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {coachMessage}
            </p>
            <div className="mt-3 pt-2 flex items-center gap-1" style={{ borderTop: '1px solid rgba(136,102,255,0.1)' }}>
              <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(136,102,255,0.3)' }} />
              <span className="typo-meta text-[8px]" style={{ color: 'rgba(136,102,255,0.3)' }}>
                Context: {dataCompleteness}% Bio-Vault · Elite {perf.eliteScore} · Recovery {perf.recovery}%
              </span>
            </div>
          </div>
        ) : (
          <p className="typo-sublabel text-[10px]" style={{ color: 'rgba(136,102,255,0.4)' }}>
            Get a personalized coaching insight based on your current Bio-Vault data and vitals
          </p>
        )}
      </div>

      {/* ═══ DATA COMPLETENESS CARD ═══ */}
      {dataCompleteness < 80 && (
        <div
          className="rounded-xl p-4 mb-3"
          style={{
            background: 'rgba(6,8,12,0.4)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,170,0,0.1)',
            animation: 'cardSlideUp 0.7s ease both 0.4s',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[12px]">🔬</span>
            <span className="typo-meta text-[10px]" style={{ color: '#ffaa00', letterSpacing: '0.08em' }}>
              PRECISION UPGRADE AVAILABLE
            </span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,170,0,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{
                width: `${dataCompleteness}%`,
                background: 'linear-gradient(90deg, #ffaa00, #00ccff)',
              }} />
            </div>
            <span className="typo-data text-[11px]" style={{ color: '#ffaa00' }}>{dataCompleteness}%</span>
          </div>
          <p className="typo-sublabel text-[10px]" style={{ color: 'rgba(255,170,0,0.5)' }}>
            {dataCompleteness < 30
              ? 'Add blood panel data to unlock personalized dosing calibrated to your biochemistry'
              : 'Add genetic markers (MTHFR, APOE4, CYP1A2) to unlock gene-specific protocol optimization'}
          </p>
        </div>
      )}

      {/* ═══ COMPLETION BANNER ═══ */}
      {adherencePct === 100 && (
        <div
          className="rounded-xl p-5 text-center"
          style={{
            background: 'rgba(0,255,170,0.03)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(0,255,170,0.15)',
            boxShadow: '0 0 20px rgba(0,255,170,0.05)',
            animation: 'cardSlideUp 0.5s ease both',
          }}
        >
          <div className="text-[24px] mb-2" style={{ filter: 'drop-shadow(0 0 12px rgba(0,255,170,0.5))' }}>{'\u2726'}</div>
          <div className="typo-meta text-[12px] tracking-[2px] mb-1" style={{
            color: '#00ffaa',
            filter: 'drop-shadow(0 0 8px rgba(0,255,170,0.3))',
          }}>
            ALL_PROTOCOLS_COMPLETE
          </div>
          <div className="typo-sublabel text-[10px]" style={{ color: 'rgba(0,240,255,0.35)' }}>
            Full adherence logged. Recovery mode active. Elite Score: {perf.eliteScore}/100
          </div>
        </div>
      )}

      {/* ═══ PROTOCOL SOURCE FOOTER ═══ */}
      <div className="mt-4 pt-3 text-center" style={{ borderTop: '1px solid rgba(0,240,255,0.04)' }}>
        <div className="typo-meta text-[8px]" style={{ color: 'rgba(0,240,255,0.15)', letterSpacing: '0.15em' }}>
          PROTOCOL ENGINE v4.0 · {protocolTier === 'personalized' ? 'PERSONALIZED' : 'BASELINE'} · {supplements.length} SUPPLEMENTS · {interventions.length} INTERVENTIONS · {dynamicTargets.length} TARGETS
        </div>
        <div className="typo-meta text-[7px] mt-1" style={{ color: 'rgba(0,240,255,0.1)' }}>
          Generated from Bio-Vault ({dataCompleteness}% complete) + Live System Vitals
        </div>
      </div>

      {/* ═══ CSS ANIMATIONS ═══ */}
      <style>{`
        @keyframes protocolWinBurst {
          0% { opacity: 0; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
};

export default ProtocolsView;
