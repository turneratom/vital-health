import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CC = {
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  accent: '#00FFCC',
  green: '#00DC82',
  purple: '#A78BFA',
  orange: '#E8976C',
  red: '#FF6B6B',
  border: 'rgba(255,255,255,0.06)',
};

interface MolecularInsight {
  sirtuinActivation: number;
  sirtuinDrivers: string[];
  cellularRepairScore: number;
  cellularRepairDrivers: string[];
  mitochondrialScore: number;
  mitochondrialDrivers: string[];
  antiInflammatoryScore: number;
  antiInflammatoryDrivers: string[];
  gutMicrobiomeScore: number;
  gutMicrobiomeDrivers: string[];
  headline: string;
  narrative: string;
}

interface MicroTotals {
  omega3mg: number;
  polyphenolsMg: number;
  sulforaphaneMcg: number;
  resveratrolMcg: number;
  quercetinMg: number;
  curcuminMg: number;
  vitaminCmg: number;
  vitaminEmg: number;
  seleniumMcg: number;
  zincMg: number;
  magnesiumMg: number;
  nad_precursorMg: number;
}

interface Props {
  molecularInsight: MolecularInsight;
  microTotals?: MicroTotals;
  fuelScore: number;
  longevityHighlights?: string[];
}

const PATHWAYS = [
  { key: 'sirtuin', label: 'Sirtuin Activation', sub: 'SIRT1 · DNA Repair', icon: '\u{1F9EC}', color: '#A78BFA', scoreKey: 'sirtuinActivation' as const, driversKey: 'sirtuinDrivers' as const, mech: 'Polyphenols activate SIRT1 deacetylase, enhancing DNA repair and metabolic efficiency' },
  { key: 'repair', label: 'Cellular Repair', sub: 'Nrf2 · Autophagy', icon: '\u{1F52C}', color: '#00DC82', scoreKey: 'cellularRepairScore' as const, driversKey: 'cellularRepairDrivers' as const, mech: 'Sulforaphane activates Nrf2 transcription factor for cellular detoxification' },
  { key: 'mito', label: 'Mitochondrial Function', sub: 'ATP · CoQ10 · Energy', icon: '\u26A1', color: '#F59E0B', scoreKey: 'mitochondrialScore' as const, driversKey: 'mitochondrialDrivers' as const, mech: 'Omega-3s integrate into mitochondrial membranes, enhancing electron transport' },
  { key: 'antiInflam', label: 'Anti-Inflammatory', sub: 'NF-\u03BAB · Prostaglandins', icon: '\u{1F6E1}\uFE0F', color: '#3B82F6', scoreKey: 'antiInflammatoryScore' as const, driversKey: 'antiInflammatoryDrivers' as const, mech: 'Omega-3 resolvins suppress NF-\u03BAB inflammatory cascade' },
  { key: 'gut', label: 'Gut Microbiome', sub: 'SCFA · Diversity', icon: '\u{1F9A0}', color: '#00FFCC', scoreKey: 'gutMicrobiomeScore' as const, driversKey: 'gutMicrobiomeDrivers' as const, mech: 'Fiber fermentation produces short-chain fatty acids for gut barrier integrity' },
];

const MICROS = [
  { key: 'omega3mg', label: 'Omega-3', unit: 'mg', optimal: 2000, color: '#3B82F6' },
  { key: 'polyphenolsMg', label: 'Polyphenols', unit: 'mg', optimal: 500, color: '#A78BFA' },
  { key: 'sulforaphaneMcg', label: 'Sulforaphane', unit: 'mcg', optimal: 30000, color: '#00DC82' },
  { key: 'vitaminCmg', label: 'Vitamin C', unit: 'mg', optimal: 90, color: '#F59E0B' },
  { key: 'magnesiumMg', label: 'Magnesium', unit: 'mg', optimal: 100, color: '#00FFCC' },
  { key: 'seleniumMcg', label: 'Selenium', unit: 'mcg', optimal: 55, color: '#E8976C' },
  { key: 'zincMg', label: 'Zinc', unit: 'mg', optimal: 11, color: '#6BA3BE' },
  { key: 'curcuminMg', label: 'Curcumin', unit: 'mg', optimal: 150, color: '#F97316' },
  { key: 'resveratrolMcg', label: 'Resveratrol', unit: 'mcg', optimal: 1000, color: '#EC4899' },
  { key: 'quercetinMg', label: 'Quercetin', unit: 'mg', optimal: 20, color: '#8B5CF6' },
  { key: 'nad_precursorMg', label: 'NAD+ Precursor', unit: 'mg', optimal: 15, color: '#14B8A6' },
  { key: 'vitaminEmg', label: 'Vitamin E', unit: 'mg', optimal: 15, color: '#84CC16' },
];

function Gauge({ score, color, size = 44 }: { score: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
        <motion.circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.min(score,100)/100) }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          style={{ fontSize: size > 48 ? 14 : 11, fontWeight: 800, fontFamily: 'monospace', color }}>{score}</motion.span>
      </div>
    </div>
  );
}

function HeroRing({ score, color }: { score: number; color: string }) {
  const s = 84, r = 34, c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: s, height: s }}>
      <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: -8, borderRadius: '50%', background: `radial-gradient(circle, ${color}20, transparent 70%)` }} />
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        <circle cx={s/2} cy={s/2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
        <motion.circle cx={s/2} cy={s/2} r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.min(score,100)/100) }}
          transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center', filter: `drop-shadow(0 0 6px ${color}60)` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}
          style={{ fontSize: 22, fontWeight: 800, fontFamily: 'monospace', color, lineHeight: 1 }}>{score}</motion.span>
        <span style={{ fontSize: 7, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.15em', marginTop: 2 }}>LONGEVITY</span>
      </div>
    </div>
  );
}

export default function CellularImpactCard({ molecularInsight, microTotals, fuelScore, longevityHighlights }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showMicros, setShowMicros] = useState(false);

  const longevityScore = Math.round(
    molecularInsight.sirtuinActivation * 0.25 + molecularInsight.cellularRepairScore * 0.25 +
    molecularInsight.mitochondrialScore * 0.2 + molecularInsight.antiInflammatoryScore * 0.2 +
    molecularInsight.gutMicrobiomeScore * 0.1
  );
  const lc = longevityScore >= 70 ? CC.green : longevityScore >= 50 ? CC.accent : longevityScore >= 30 ? CC.orange : CC.red;
  const dominant = PATHWAYS.map(p => ({ ...p, score: molecularInsight[p.scoreKey] })).sort((a, b) => b.score - a.score)[0];
  const activeMicros = microTotals ? MICROS.filter(m => (microTotals as any)[m.key] > 0) : [];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
      style={{ borderRadius: 16, overflow: 'hidden', background: 'rgba(10,10,14,0.92)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)' }}>
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${dominant.color}50, ${lc}50, transparent)` }} />

      {/* Header */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
          <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: dominant.color, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            CELLULAR IMPACT ANALYSIS
          </span>
          <span style={{ fontSize: 7, fontFamily: 'monospace', color: CC.purple, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.2)', padding: '1px 5px', borderRadius: 3, letterSpacing: '0.1em' }}>AI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <HeroRing score={longevityScore} color={lc} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
              style={{ fontSize: 13, fontWeight: 600, color: CC.text, lineHeight: 1.5, marginBottom: 6 }}>
              {molecularInsight.headline}
            </motion.div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: lc, background: `${lc}15`, border: `1px solid ${lc}30`, padding: '2px 6px', borderRadius: 4, letterSpacing: '0.08em' }}>
                {longevityScore >= 70 ? 'EXCEPTIONAL' : longevityScore >= 50 ? 'STRONG' : longevityScore >= 30 ? 'MODERATE' : 'LOW'} IMPACT
              </span>
              <span style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer }}>Fuel {fuelScore}/10</span>
            </div>
          </div>
        </div>
      </div>

      {/* Narrative */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', borderLeft: `2px solid ${dominant.color}40` }}>
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: CC.textSec, lineHeight: 1.7, fontStyle: 'italic' }}>
            {molecularInsight.narrative}
          </div>
        </div>
      </div>

      {/* Pathways */}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>MOLECULAR PATHWAYS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {PATHWAYS.map((pw, i) => {
            const score = molecularInsight[pw.scoreKey];
            const drivers = molecularInsight[pw.driversKey];
            const isExp = expanded === pw.key;
            const active = score > 15;
            return (
              <motion.div key={pw.key} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 * i }}>
                <button onClick={() => setExpanded(isExp ? null : pw.key)}
                  style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 12,
                    background: isExp ? `${pw.color}08` : active ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)',
                    border: `1px solid ${isExp ? `${pw.color}20` : active ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)'}`,
                    transition: 'all 0.2s' }}>
                  <Gauge score={score} color={pw.color} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12 }}>{pw.icon}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: active ? CC.text : CC.textSec }}>{pw.label}</span>
                      {score >= 60 && <span style={{ fontSize: 7, fontFamily: 'monospace', fontWeight: 700, color: pw.color, background: `${pw.color}15`, padding: '1px 4px', borderRadius: 3, letterSpacing: '0.08em' }}>ACTIVE</span>}
                    </div>
                    <div style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer, marginTop: 2 }}>{pw.sub}</div>
                    <div style={{ height: 2, borderRadius: 1, marginTop: 6, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(score, 100)}%` }}
                        transition={{ duration: 1, ease: 'easeOut', delay: 0.2 + i * 0.1 }}
                        style={{ height: '100%', borderRadius: 1, background: `linear-gradient(90deg, ${pw.color}80, ${pw.color})`, boxShadow: score >= 40 ? `0 0 8px ${pw.color}40` : 'none' }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: CC.textTer, transform: isExp ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>{'\u25BE'}</span>
                </button>
                <AnimatePresence>
                  {isExp && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
                      <div style={{ padding: '8px 12px 8px 66px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 9, fontFamily: 'monospace', color: pw.color, lineHeight: 1.5, marginBottom: 4, opacity: 0.8 }}>{'\u21B3'} {pw.mech}</div>
                        {drivers.map((d, di) => (
                          <div key={di} style={{ fontSize: 9, fontFamily: 'monospace', color: CC.textSec, lineHeight: 1.5, paddingLeft: 8, borderLeft: `1.5px solid ${pw.color}30` }}>{d}</div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Micronutrients */}
      {activeMicros.length > 0 && (
        <div style={{ padding: '14px 16px 0' }}>
          <button onClick={() => setShowMicros(!showMicros)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', cursor: 'pointer', background: 'none', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 8, fontFamily: 'monospace', color: CC.textTer, letterSpacing: '0.15em', textTransform: 'uppercase' }}>MICRONUTRIENT PROFILE</span>
              <span style={{ fontSize: 7, fontFamily: 'monospace', color: CC.accent, background: 'rgba(0,255,204,0.08)', padding: '1px 5px', borderRadius: 3 }}>{activeMicros.length} DETECTED</span>
            </div>
            <span style={{ fontSize: 10, color: CC.textTer, transform: showMicros ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>{'\u25BE'}</span>
          </button>
          <AnimatePresence>
            {showMicros && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingBottom: 4 }}>
                  {activeMicros.map((m, i) => {
                    const val = (microTotals as any)[m.key];
                    const pct = Math.min((val / m.optimal) * 100, 100);
                    return (
                      <motion.div key={m.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                        style={{ padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: `1px solid ${pct >= 80 ? `${m.color}20` : 'rgba(255,255,255,0.04)'}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 9, fontFamily: 'monospace', color: CC.textSec, fontWeight: 600 }}>{m.label}</span>
                          {pct >= 80 && <span style={{ fontSize: 8, color: m.color }}>{'\u2713'}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', flex: 1 }}>
                            <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                              style={{ height: '100%', borderRadius: 2, background: m.color, boxShadow: `0 0 6px ${m.color}40` }} />
                          </div>
                          <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: pct >= 80 ? m.color : CC.textSec, minWidth: 40, textAlign: 'right' }}>
                            {val >= 1000 ? `${(val/1000).toFixed(1)}k` : Math.round(val)}<span style={{ fontSize: 7, color: CC.textTer }}>{m.unit}</span>
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Longevity Highlights */}
      {longevityHighlights && longevityHighlights.length > 0 && (
        <div style={{ padding: '12px 16px 16px' }}>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,255,204,0.03)', border: '1px solid rgba(0,255,204,0.08)' }}>
            <div style={{ fontSize: 8, fontFamily: 'monospace', color: CC.accent, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 700 }}>
              {'\u{1F9EC}'} LONGEVITY INTEL
            </div>
            {longevityHighlights.map((h, i) => (
              <div key={i} style={{ fontSize: 9, fontFamily: 'monospace', color: CC.textSec, lineHeight: 1.6, paddingLeft: 8, borderLeft: '2px solid rgba(0,255,204,0.15)', marginBottom: i < longevityHighlights.length - 1 ? 4 : 0 }}>{h}</div>
            ))}
          </div>
        </div>
      )}
      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${lc}20, transparent)` }} />
    </motion.div>
  );
}
