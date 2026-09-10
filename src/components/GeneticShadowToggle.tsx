import React, { useState, useEffect, useCallback } from 'react';
import {
  type GeneticProfile,
  type SNPStatus,
  type ShadowedIntervention,
  type GeneticShadowSummary,
  DEFAULT_GENETIC_PROFILE,
  SNP_REGISTRY,
  getGeneticShadowSummary,
} from '@/lib/GeneticShadow';

/* ══════════════════════════════════════════════════════════════ */
/*  GENETIC SHADOW TOGGLE — HUD SNP Input + Filter Toggle       */
/*                                                                */
/*  Two modes:                                                    */
/*  1. Collapsed: Small DNA badge showing active SNP count        */
/*  2. Expanded: Full SNP input panel with status selectors       */
/* ══════════════════════════════════════════════════════════════ */

interface GeneticShadowToggleProps {
  profile: GeneticProfile;
  onProfileChange: (profile: GeneticProfile) => void;
  shadowEnabled: boolean;
  onToggleShadow: (enabled: boolean) => void;
  summary?: GeneticShadowSummary;
  /** Compact mode for embedding in other panels */
  compact?: boolean;
}

const STATUS_OPTIONS: { value: SNPStatus; label: string; color: string; icon: string }[] = [
  { value: 'unknown', label: 'Unknown', color: 'rgba(255,255,255,0.15)', icon: '?' },
  { value: 'none', label: 'Normal', color: '#00DC82', icon: '✓' },
  { value: 'heterozygous', label: 'Hetero (+/-)', color: '#FFB86B', icon: '½' },
  { value: 'homozygous', label: 'Homo (+/+)', color: '#FF6B6B', icon: '⬤' },
];

export function GeneticShadowToggle({
  profile,
  onProfileChange,
  shadowEnabled,
  onToggleShadow,
  summary,
  compact = false,
}: GeneticShadowToggleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingProfile, setEditingProfile] = useState<GeneticProfile>(profile);

  useEffect(() => {
    setEditingProfile(profile);
  }, [profile]);

  const activeSNPs = Object.entries(profile).filter(([k, v]) => {
    if (k === 'cyp1a2SlowMetabolizer') return v === true;
    return v !== 'unknown' && v !== 'none';
  }).length;

  const knownSNPs = Object.entries(profile).filter(([k, v]) => {
    if (k === 'cyp1a2SlowMetabolizer') return true; // always "known"
    return v !== 'unknown';
  }).length;

  const handleSNPChange = useCallback((key: keyof Omit<GeneticProfile, 'cyp1a2SlowMetabolizer'>, value: SNPStatus) => {
    const updated = { ...editingProfile, [key]: value };
    setEditingProfile(updated);
    onProfileChange(updated);
  }, [editingProfile, onProfileChange]);

  const handleCaffeineToggle = useCallback(() => {
    const updated = { ...editingProfile, cyp1a2SlowMetabolizer: !editingProfile.cyp1a2SlowMetabolizer };
    setEditingProfile(updated);
    onProfileChange(updated);
  }, [editingProfile, onProfileChange]);

  const badgeColor = activeSNPs > 0
    ? (summary?.contraindications ?? 0) > 0 ? '#FF6B6B' : '#AF82FF'
    : 'rgba(175,130,255,0.3)';

  if (compact) {
    return (
      <CompactBadge
        activeSNPs={activeSNPs}
        shadowEnabled={shadowEnabled}
        onToggle={() => onToggleShadow(!shadowEnabled)}
        badgeColor={badgeColor}
        summary={summary}
      />
    );
  }

  return (
    <>
      {/* ── Collapsed Badge ── */}
      <button
        onClick={() => setIsExpanded(e => !e)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 active:scale-[0.97]"
        style={{
          background: isExpanded
            ? 'rgba(175,130,255,0.12)'
            : 'rgba(175,130,255,0.05)',
          border: `1px solid ${isExpanded ? 'rgba(175,130,255,0.25)' : 'rgba(175,130,255,0.1)'}`,
        }}
      >
        <span className="text-sm">🧬</span>
        <span className="font-mono text-[10px] font-semibold" style={{ color: badgeColor }}>
          GENETIC SHADOW
        </span>
        {activeSNPs > 0 && (
          <span className="font-mono text-[8px] px-1.5 py-0.5 rounded" style={{
            background: `${badgeColor}18`,
            color: badgeColor,
            border: `1px solid ${badgeColor}30`,
          }}>
            {activeSNPs} SNP{activeSNPs > 1 ? 's' : ''}
          </span>
        )}
        {summary && summary.contraindications > 0 && (
          <span className="font-mono text-[8px] px-1.5 py-0.5 rounded" style={{
            background: 'rgba(255,107,107,0.12)',
            color: '#FF6B6B',
            border: '1px solid rgba(255,107,107,0.25)',
          }}>
            {summary.contraindications} ⛔
          </span>
        )}
        {/* Toggle */}
        <div
          onClick={(e) => { e.stopPropagation(); onToggleShadow(!shadowEnabled); }}
          className="ml-auto flex items-center gap-1 cursor-pointer"
        >
          <div className="relative w-8 h-4 rounded-full transition-all duration-200" style={{
            background: shadowEnabled ? 'rgba(175,130,255,0.3)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${shadowEnabled ? 'rgba(175,130,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
          }}>
            <div className="absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200" style={{
              left: shadowEnabled ? '16px' : '2px',
              background: shadowEnabled ? '#AF82FF' : 'rgba(255,255,255,0.3)',
              boxShadow: shadowEnabled ? '0 0 6px rgba(175,130,255,0.4)' : 'none',
            }} />
          </div>
        </div>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="rgba(175,130,255,0.4)" strokeWidth="2" strokeLinecap="round"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* ── Expanded Panel ── */}
      {isExpanded && (
        <div className="mt-2 rounded-xl overflow-hidden" style={{
          background: 'rgba(175,130,255,0.03)',
          border: '1px solid rgba(175,130,255,0.1)',
          animation: 'geneticFadeIn 0.2s ease',
        }}>
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2" style={{
            borderBottom: '1px solid rgba(175,130,255,0.08)',
          }}>
            <span className="text-base">🧬</span>
            <div className="flex-1">
              <span className="font-mono text-[10px] font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.8)' }}>
                SNP PROFILE
              </span>
              <span className="font-mono text-[8px] block" style={{ color: 'rgba(175,130,255,0.4)' }}>
                {knownSNPs}/7 variants configured &middot; Tap to set your genotype
              </span>
            </div>
            <div className="px-2 py-1 rounded-lg" style={{
              background: `${badgeColor}10`,
              border: `1px solid ${badgeColor}20`,
            }}>
              <span className="font-mono text-[8px]" style={{ color: badgeColor }}>
                {summary?.profileCompleteness ?? 0}% COMPLETE
              </span>
            </div>
          </div>

          {/* SNP Grid */}
          <div className="px-4 py-3 space-y-3">
            {SNP_REGISTRY.map(snp => {
              const currentValue = editingProfile[snp.key];
              return (
                <div key={snp.key}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm">{snp.icon}</span>
                    <div className="flex-1">
                      <span className="font-mono text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
                        {snp.label}
                      </span>
                      <span className="font-mono text-[7px] ml-1.5" style={{ color: 'rgba(175,130,255,0.3)' }}>
                        {snp.rsid}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    {STATUS_OPTIONS.map(opt => {
                      const isActive = currentValue === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleSNPChange(snp.key, opt.value)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all duration-150 active:scale-[0.97]"
                          style={{
                            background: isActive ? `${opt.color}15` : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${isActive ? `${opt.color}35` : 'rgba(255,255,255,0.06)'}`,
                          }}
                        >
                          <span className="text-[8px]" style={{ color: isActive ? opt.color : 'rgba(255,255,255,0.2)' }}>
                            {opt.icon}
                          </span>
                          <span className="font-mono text-[7px]" style={{
                            color: isActive ? opt.color : 'rgba(255,255,255,0.25)',
                            fontWeight: isActive ? 600 : 400,
                          }}>
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <span className="font-mono text-[7px] block" style={{ color: 'rgba(255,255,255,0.2)' }}>
                    {snp.description}
                  </span>
                </div>
              );
            })}

            {/* CYP1A2 Caffeine Toggle */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm">☕</span>
                <div className="flex-1">
                  <span className="font-mono text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    CYP1A2 Caffeine Metabolism
                  </span>
                  <span className="font-mono text-[7px] ml-1.5" style={{ color: 'rgba(175,130,255,0.3)' }}>
                    rs762551
                  </span>
                </div>
              </div>
              <button
                onClick={handleCaffeineToggle}
                className="w-full flex items-center gap-2 py-2 px-3 rounded-lg transition-all duration-150"
                style={{
                  background: editingProfile.cyp1a2SlowMetabolizer ? 'rgba(255,184,107,0.08)' : 'rgba(0,220,130,0.05)',
                  border: `1px solid ${editingProfile.cyp1a2SlowMetabolizer ? 'rgba(255,184,107,0.2)' : 'rgba(0,220,130,0.15)'}`,
                }}
              >
                <div className="relative w-8 h-4 rounded-full" style={{
                  background: editingProfile.cyp1a2SlowMetabolizer ? 'rgba(255,184,107,0.3)' : 'rgba(0,220,130,0.2)',
                }}>
                  <div className="absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200" style={{
                    left: editingProfile.cyp1a2SlowMetabolizer ? '16px' : '2px',
                    background: editingProfile.cyp1a2SlowMetabolizer ? '#FFB86B' : '#00DC82',
                  }} />
                </div>
                <span className="font-mono text-[9px]" style={{
                  color: editingProfile.cyp1a2SlowMetabolizer ? '#FFB86B' : '#00DC82',
                }}>
                  {editingProfile.cyp1a2SlowMetabolizer ? 'Slow Metabolizer (AC/CC)' : 'Fast Metabolizer (AA)'}
                </span>
              </button>
              <span className="font-mono text-[7px] block mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Determines caffeine clearance speed — slow metabolizers should limit intake and enforce AM cutoff
              </span>
            </div>
          </div>

          {/* Summary Footer */}
          {summary && summary.totalModifiers > 0 && (
            <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap" style={{
              borderTop: '1px solid rgba(175,130,255,0.08)',
              background: 'rgba(175,130,255,0.02)',
            }}>
              {summary.boosts > 0 && (
                <span className="font-mono text-[8px] flex items-center gap-1" style={{ color: '#00DC82' }}>
                  ↑ {summary.boosts} boosted
                </span>
              )}
              {summary.warnings > 0 && (
                <span className="font-mono text-[8px] flex items-center gap-1" style={{ color: '#FFB86B' }}>
                  ⚠ {summary.warnings} warnings
                </span>
              )}
              {summary.contraindications > 0 && (
                <span className="font-mono text-[8px] flex items-center gap-1" style={{ color: '#FF6B6B' }}>
                  ⛔ {summary.contraindications} contraindicated
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes geneticFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

/* ── Compact Badge for embedding in other panels ── */
function CompactBadge({
  activeSNPs,
  shadowEnabled,
  onToggle,
  badgeColor,
  summary,
}: {
  activeSNPs: number;
  shadowEnabled: boolean;
  onToggle: () => void;
  badgeColor: string;
  summary?: GeneticShadowSummary;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all duration-150 active:scale-[0.97]"
      style={{
        background: shadowEnabled ? 'rgba(175,130,255,0.08)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${shadowEnabled ? 'rgba(175,130,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <span className="text-[10px]">🧬</span>
      <span className="font-mono text-[7px] tracking-wider" style={{
        color: shadowEnabled ? '#AF82FF' : 'rgba(255,255,255,0.3)',
      }}>
        SHADOW {shadowEnabled ? 'ON' : 'OFF'}
      </span>
      {shadowEnabled && activeSNPs > 0 && (
        <span className="font-mono text-[7px] px-1 py-0.5 rounded" style={{
          background: `${badgeColor}12`,
          color: badgeColor,
        }}>
          {activeSNPs}
        </span>
      )}
      {shadowEnabled && summary && summary.contraindications > 0 && (
        <span className="text-[8px]">⛔</span>
      )}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/*  GENETIC MODIFIER BADGE — Inline badge for intervention cards */
/* ══════════════════════════════════════════════════════════════ */

export function GeneticModifierBadge({ intervention }: { intervention: ShadowedIntervention }) {
  const [showDetails, setShowDetails] = useState(false);

  if (intervention.geneticModifiers.length === 0) return null;

  const hasContra = intervention.isContraindicated;
  const hasBoosted = intervention.isGeneticallyBoosted;
  const primaryMod = intervention.geneticModifiers[0];

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setShowDetails(d => !d)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all duration-150 w-full text-left"
        style={{
          background: hasContra
            ? 'rgba(255,107,107,0.06)'
            : hasBoosted
            ? 'rgba(0,220,130,0.04)'
            : 'rgba(255,184,107,0.05)',
          border: `1px solid ${hasContra ? 'rgba(255,107,107,0.15)' : hasBoosted ? 'rgba(0,220,130,0.12)' : 'rgba(255,184,107,0.12)'}`,
        }}
      >
        <span className="text-[10px]">🧬</span>
        <span className="font-mono text-[7px] tracking-wider flex-1" style={{
          color: hasContra ? '#FF6B6B' : hasBoosted ? '#00DC82' : '#FFB86B',
        }}>
          {hasContra ? '⛔ GENETIC CONTRAINDICATION' : hasBoosted ? '↑ GENETICALLY BOOSTED' : '⚠ GENETIC WARNING'}
          <span className="ml-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
            ({intervention.geneticModifiers.length} modifier{intervention.geneticModifiers.length > 1 ? 's' : ''})
          </span>
        </span>
        <svg
          width="8" height="8" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"
          style={{ transform: showDetails ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {showDetails && (
        <div className="mt-1 space-y-1.5 pl-2">
          {intervention.geneticModifiers.map((mod, i) => (
            <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-lg" style={{
              background: `${mod.color}06`,
              border: `1px solid ${mod.color}12`,
            }}>
              <span className="text-[10px] mt-0.5 flex-shrink-0">{mod.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-mono text-[7px] font-semibold" style={{ color: mod.color }}>
                    {mod.snpLabel}
                  </span>
                  <span className="font-mono text-[6px] px-1 py-0.5 rounded" style={{
                    background: `${mod.color}10`,
                    color: mod.color,
                    border: `1px solid ${mod.color}20`,
                  }}>
                    {mod.type.toUpperCase()}
                  </span>
                </div>
                <p className="font-mono text-[8px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {mod.message}
                </p>
                {mod.substitute && (
                  <p className="font-mono text-[8px] mt-0.5" style={{ color: '#00DC82' }}>
                    → Substitute: {mod.substitute}
                  </p>
                )}
              </div>
            </div>
          ))}
          {intervention.originalConfidence !== intervention.confidence && (
            <div className="flex items-center gap-2 px-2 py-1">
              <span className="font-mono text-[7px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Confidence: {intervention.originalConfidence}% → {intervention.confidence}%
                <span className="ml-1" style={{
                  color: intervention.confidence > intervention.originalConfidence ? '#00DC82' : '#FF6B6B',
                }}>
                  ({intervention.confidence > intervention.originalConfidence ? '+' : ''}{intervention.confidence - intervention.originalConfidence}%)
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default GeneticShadowToggle;
