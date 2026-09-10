import { useState } from 'react';
import { motion } from 'framer-motion';
import { useGhostMode } from '@/components/Presence/usePresenceState';
import { chapters, insights } from './data';
import { ChapterHeader } from './ChapterHeader';
import { InsightCard } from './InsightCard';
import { HelixGraphic, type HelixMarker } from './HelixGraphic';
import { ParallaxHero } from './ParallaxHero';
import { calculateBiologicalAgeOffset } from '@/lib/bioSyncLogic';

/* ── Map BioVault vulnerability markers onto the helix ── */
const VULNERABILITY_MARKERS: HelixMarker[] = [
  {
    id: 'mthfr',
    label: 'MTHFR Variant',
    shortLabel: 'MTHFR',
    position: 0.08,
    status: 'variant',
    icon: '🧬',
    detail: 'Methylation impaired',
  },
  {
    id: 'caffeine',
    label: 'Caffeine Sensitivity',
    shortLabel: 'CYP1A2',
    position: 0.18,
    status: 'variant',
    icon: '☕',
    detail: 'Slow metabolizer',
  },
  {
    id: 'vitd',
    label: 'Vitamin D Absorption',
    shortLabel: 'VDR Gene',
    position: 0.30,
    status: 'risk',
    icon: '☀️',
    detail: 'Reduced absorption',
  },
  {
    id: 'apoe4',
    label: 'APOE4 Status',
    shortLabel: 'APOE',
    position: 0.42,
    status: 'optimal',
    icon: '🧠',
    detail: 'No variant detected',
  },
  {
    id: 'actn3',
    label: 'Sprint / Power Gene',
    shortLabel: 'ACTN3',
    position: 0.54,
    status: 'optimal',
    icon: '⚡',
    detail: 'R/R — elite power',
  },
  {
    id: 'sod2',
    label: 'Oxidative Stress',
    shortLabel: 'SOD2',
    position: 0.65,
    status: 'risk',
    icon: '🛡️',
    detail: 'Reduced defense',
  },
  {
    id: 'fat',
    label: 'Fat Metabolism',
    shortLabel: 'FTO',
    position: 0.76,
    status: 'variant',
    icon: '🥑',
    detail: 'Moderate sensitivity',
  },
  {
    id: 'salt',
    label: 'Salt Sensitivity',
    shortLabel: 'ACE',
    position: 0.86,
    status: 'variant',
    icon: '🧂',
    detail: 'Higher BP response',
  },
  {
    id: 'recovery',
    label: 'Recovery Speed',
    shortLabel: 'IL-6',
    position: 0.94,
    status: 'optimal',
    icon: '💤',
    detail: 'Fast recovery',
  },
];

/* ── Demo biomarker data (would come from BioVault in production) ── */
const DEMO_BIO_AGE_INPUT = {
  chronologicalAge: 34,
  biomarkers: {
    vitaminD: 52,
    ferritin: 85,
    crp: 0.6,
    hba1c: 5.1,
    testosteroneTotal: 680,
    testosteroneFree: 18,
  },
  lifestyle: {
    sleepHours: 7.5,
    hrv: 62,
    recovery: 78,
    activityScore: 72,
    supplementAdherence: 88,
  },
};

function DNAView({ mounted }: { mounted?: boolean }) {
  const ghostMode = useGhostMode();
  const neon = ghostMode ? 'rgba(160,160,160,' : 'rgba(0,255,204,';
  const [activeSection, setActiveSection] = useState<'helix' | 'insights'>('helix');

  /* ── Bio Age calculation for header display ── */
  const bioAge = calculateBiologicalAgeOffset(DEMO_BIO_AGE_INPUT);

  const optimalCount = VULNERABILITY_MARKERS.filter((m) => m.status === 'optimal').length;
  const variantCount = VULNERABILITY_MARKERS.filter((m) => m.status === 'variant').length;
  const riskCount = VULNERABILITY_MARKERS.filter((m) => m.status === 'risk').length;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col h-full relative">
      {/* ── Parallax 3D Background ── */}
      <div
        className="flex-1 overflow-y-auto min-h-0 relative"
        data-dna-scroll
        style={{ scrollbarWidth: 'none' }}
      >
        <ParallaxHero ghostMode={ghostMode} bioAgeInput={DEMO_BIO_AGE_INPUT} />

        {/* ── Content overlay ── */}
        <div className="relative z-10">
          {/* Hero header */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
            className="text-center mb-2 pt-52 px-4"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  background: ghostMode ? 'rgba(160,160,160,0.4)' : '#00FFCC',
                  boxShadow: ghostMode ? 'none' : '0 0 8px rgba(0,255,204,0.5)',
                }}
              />
              <span
                className="text-[9px] font-mono uppercase tracking-[0.3em]"
                style={{ color: `${neon}0.4)` }}
              >
                Genome Decoded
              </span>
            </div>
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{
                color: ghostMode ? 'rgba(200,200,200,0.7)' : '#00FFCC',
                textShadow: ghostMode ? 'none' : '0 0 30px rgba(0,255,204,0.15)',
              }}
            >
              Your Blueprint
            </h1>
            <p
              className="text-[13px] mt-2 max-w-md mx-auto leading-relaxed"
              style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.4)' }}
            >
              Your genetic data, translated into plain language. Vulnerability markers mapped onto your unique double helix.
            </p>

            {/* ── Performance Delta Summary Bar ── */}
            <div
              className="mt-4 mx-auto max-w-xs flex items-center justify-center gap-3 px-4 py-2 rounded-xl"
              style={{
                background: ghostMode ? 'rgba(160,160,160,0.03)' : `${bioAge.glowColor.replace('0.3)', '0.06)')}`,
                border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : bioAge.glowColor.replace('0.3)', '0.12)')}`,
                backdropFilter: 'blur(8px)',
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]">
                  {bioAge.direction === 'younger' ? '🟢' : bioAge.direction === 'older' ? '🟠' : '🟡'}
                </span>
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: ghostMode ? 'rgba(200,200,200,0.5)' : bioAge.color }}
                >
                  Performance Delta: {bioAge.label}
                </span>
              </div>
              <div
                className="w-px h-4"
                style={{ background: ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(255,255,255,0.1)' }}
              />
              <span
                className="text-[10px] font-mono"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.3)' }}
              >
                Chrono {DEMO_BIO_AGE_INPUT.chronologicalAge} → Bio {bioAge.biologicalAge.toFixed(1)}
              </span>
            </div>

            {/* Stats bar */}
            <div className="flex items-center justify-center gap-6 mt-4">
              {[
                { label: 'Markers', value: String(VULNERABILITY_MARKERS.length), color: ghostMode ? 'rgba(200,200,200,0.6)' : '#00FFCC' },
                { label: 'Optimal', value: String(optimalCount), color: ghostMode ? 'rgba(200,200,200,0.6)' : '#00FFCC' },
                { label: 'Variants', value: String(variantCount), color: ghostMode ? 'rgba(200,200,200,0.6)' : '#FFB86B' },
                { label: 'At Risk', value: String(riskCount), color: ghostMode ? 'rgba(200,200,200,0.6)' : '#FF6B6B' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <span
                    className="text-lg font-bold font-mono tabular-nums"
                    style={{ color: stat.color }}
                  >
                    {stat.value}
                  </span>
                  <span
                    className="text-[9px] font-mono block mt-0.5"
                    style={{ color: `${neon}0.3)` }}
                  >
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Section toggle */}
            <div className="flex items-center justify-center gap-1 mt-6">
              {(['helix', 'insights'] as const).map((section) => (
                <button
                  key={section}
                  onClick={() => setActiveSection(section)}
                  className="px-4 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-[0.15em] transition-all duration-200"
                  style={{
                    background: activeSection === section
                      ? ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(0,255,204,0.1)'
                      : 'transparent',
                    color: activeSection === section
                      ? ghostMode ? 'rgba(200,200,200,0.7)' : '#00FFCC'
                      : ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.25)',
                    border: `1px solid ${activeSection === section
                      ? ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(0,255,204,0.2)'
                      : 'transparent'}`,
                  }}
                >
                  {section === 'helix' ? '🧬 Helix Map' : '📋 Insights'}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ── Helix Section ── */}
          {activeSection === 'helix' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="px-2 mt-4"
            >
              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mb-4">
                {[
                  { label: 'Optimal', color: '#00FFCC' },
                  { label: 'Variant', color: '#FFB86B' },
                  { label: 'At Risk', color: '#FF6B6B' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: ghostMode ? 'rgba(160,160,160,0.3)' : item.color,
                        boxShadow: ghostMode ? 'none' : `0 0 4px ${item.color}40`,
                      }}
                    />
                    <span
                      className="text-[9px] font-mono"
                      style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.35)' }}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Double Helix Graphic */}
              <HelixGraphic
                markers={VULNERABILITY_MARKERS}
                ghostMode={ghostMode}
                glowColor={bioAge.direction}
              />

              {/* Marker detail cards below helix */}
              <div className="mt-6 px-2 flex flex-col gap-2 pb-6">
                {VULNERABILITY_MARKERS.map((marker) => {
                  const statusColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
                    optimal: {
                      bg: ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(0,255,204,0.04)',
                      border: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(0,255,204,0.1)',
                      text: ghostMode ? 'rgba(200,200,200,0.6)' : '#00FFCC',
                      dot: ghostMode ? 'rgba(160,160,160,0.3)' : '#00FFCC',
                    },
                    variant: {
                      bg: ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(255,184,107,0.04)',
                      border: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,184,107,0.1)',
                      text: ghostMode ? 'rgba(200,200,200,0.6)' : '#FFB86B',
                      dot: ghostMode ? 'rgba(160,160,160,0.3)' : '#FFB86B',
                    },
                    risk: {
                      bg: ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(255,107,107,0.04)',
                      border: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,107,107,0.1)',
                      text: ghostMode ? 'rgba(200,200,200,0.6)' : '#FF6B6B',
                      dot: ghostMode ? 'rgba(160,160,160,0.3)' : '#FF6B6B',
                    },
                    unknown: {
                      bg: 'rgba(255,255,255,0.02)',
                      border: 'rgba(255,255,255,0.05)',
                      text: 'rgba(255,255,255,0.3)',
                      dot: 'rgba(255,255,255,0.2)',
                    },
                  };
                  const sc = statusColors[marker.status];

                  return (
                    <motion.div
                      key={marker.id}
                      initial={{ opacity: 0, x: -12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: '-20px' }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{
                        background: sc.bg,
                        border: `1px solid ${sc.border}`,
                        backdropFilter: 'blur(8px)',
                      }}
                    >
                      <span className="text-base shrink-0">{marker.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[12px] font-semibold truncate"
                            style={{ color: ghostMode ? 'rgba(200,200,200,0.8)' : 'rgba(255,255,255,0.85)' }}
                          >
                            {marker.label}
                          </span>
                          <span
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
                            style={{
                              background: `${sc.dot}15`,
                              color: sc.text,
                              border: `1px solid ${sc.dot}25`,
                            }}
                          >
                            {marker.shortLabel}
                          </span>
                        </div>
                        <span
                          className="text-[10px] block mt-0.5"
                          style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.35)' }}
                        >
                          {marker.detail}
                        </span>
                      </div>
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          background: sc.dot,
                          boxShadow: ghostMode ? 'none' : `0 0 6px ${sc.dot}40`,
                        }}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ── Insights Section (original chapters) ── */}
          {activeSection === 'insights' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="px-3 mt-2 pb-6"
            >
              {chapters.map((chapter) => {
                const chapterInsights = insights.filter((i) => i.chapter === chapter.id);
                return (
                  <div key={chapter.id}>
                    <ChapterHeader chapter={chapter} ghostMode={ghostMode} />
                    <div className="flex flex-col gap-3">
                      {chapterInsights.map((insight, idx) => (
                        <InsightCard
                          key={insight.humanTitle}
                          insight={insight}
                          index={idx}
                          ghostMode={ghostMode}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Footer note */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-10 mb-4 text-center"
              >
                <div
                  className="h-px w-16 mx-auto mb-4"
                  style={{ background: `${neon}0.1)` }}
                />
                <p
                  className="text-[11px] leading-relaxed max-w-sm mx-auto"
                  style={{ color: `${neon}0.25)` }}
                >
                  Your genetic data is encrypted and stored locally. These insights are based on peer-reviewed research and should complement — not replace — professional medical advice.
                </p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1L7.5 4.5L11 5L8.5 7.5L9 11L6 9.5L3 11L3.5 7.5L1 5L4.5 4.5L6 1Z" fill={ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(0,255,204,0.3)'} />
                  </svg>
                  <span className="text-[9px] font-mono" style={{ color: `${neon}0.3)` }}>
                    Last updated 3 days ago
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DNAView;
