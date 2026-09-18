import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

import { getTwinSessionId } from '@/lib/twinSession'
/* ══════════════════════════════════════════════════════════════
   DESIGN TOKENS — Command Center Aesthetic
   ══════════════════════════════════════════════════════════════ */
const T = {
  bg: '#06060A',
  surface: 'rgba(12,12,18,0.85)',
  elevated: 'rgba(18,18,26,0.92)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  cyan: '#00F0FF',
  cyanDim: 'rgba(0,240,255,0.12)',
  cyanGlow: 'rgba(0,240,255,0.06)',
  green: '#00FFCC',
  greenDim: 'rgba(0,255,204,0.12)',
  orange: '#FF8C00',
  orangeDim: 'rgba(255,140,0,0.12)',
  purple: '#BF5AF2',
  purpleDim: 'rgba(191,90,242,0.12)',
  border: 'rgba(255,255,255,0.06)',
  borderActive: 'rgba(0,240,255,0.25)',
};

/* ── Types ── */
type PerformanceGoal = 'cognitive' | 'physical' | 'longevity';

interface FirstWinProtocol {
  id: string;
  name: string;
  icon: string;
  category: string;
  timeOfDay: string;
  description: string;
  scienceNote: string;
  biomarkerTarget: string;
  impactScore: number; // 1-10
  difficulty: 'easy' | 'medium' | 'hard';
}

interface OnboardingState {
  goal: PerformanceGoal | null;
  supplements: string[];
  selectedProtocols: string[];
}

/* ══════════════════════════════════════════════════════════════
   AI BRAIN — Goal-Based First Win Protocol Recommendations
   
   Maps each longevity goal to 3 high-impact, low-friction
   protocols that produce measurable biomarker changes within
   7-14 days. This is the "first win" engine.
   ══════════════════════════════════════════════════════════════ */
const FIRST_WIN_PROTOCOLS: Record<PerformanceGoal, FirstWinProtocol[]> = {
  cognitive: [
    {
      id: 'cog-morning-light',
      name: 'Morning Sunlight Protocol',
      icon: '☀️',
      category: 'habits',
      timeOfDay: 'morning',
      description: '10 min direct sunlight within 30 min of waking. Sets circadian clock, boosts cortisol awakening response, and primes dopamine pathways for sustained focus.',
      scienceNote: 'Huberman Lab: Morning light exposure increases cortisol peak by 50% and shifts melatonin onset earlier, improving sleep latency by 20-40 min within 5 days.',
      biomarkerTarget: 'Vitamin D ↑ · Cortisol Rhythm ↑ · Sleep Latency ↓',
      impactScore: 9,
      difficulty: 'easy',
    },
    {
      id: 'cog-magnesium',
      name: 'Magnesium Glycinate 400mg',
      icon: '🧊',
      category: 'supplements',
      timeOfDay: 'evening',
      description: 'Take 400mg Magnesium Glycinate 60 min before bed. Crosses blood-brain barrier, enhances GABA activity, and supports deep sleep architecture critical for memory consolidation.',
      scienceNote: 'Magnesium deficiency affects 68% of adults. Glycinate form has 2.3x higher bioavailability than oxide. Improves deep sleep % by 15-20% within 7 days.',
      biomarkerTarget: 'HRV ↑ · Sleep Quality ↑ · hs-CRP ↓',
      impactScore: 8,
      difficulty: 'easy',
    },
    {
      id: 'cog-lions-mane',
      name: "Lion's Mane 1000mg",
      icon: '🍄',
      category: 'supplements',
      timeOfDay: 'morning',
      description: "Take 1000mg Lion's Mane extract with breakfast. Stimulates Nerve Growth Factor (NGF) production, supporting neuroplasticity, memory formation, and cognitive clarity.",
      scienceNote: "Double-blind RCT: Lion's Mane improved cognitive function scores by 14% over 16 weeks. NGF upregulation detectable in serum within 14 days of consistent use.",
      biomarkerTarget: 'Focus Duration ↑ · Memory Recall ↑ · NGF ↑',
      impactScore: 7,
      difficulty: 'easy',
    },
  ],
  physical: [
    {
      id: 'phys-creatine',
      name: 'Creatine Monohydrate 5g',
      icon: '💪',
      category: 'supplements',
      timeOfDay: 'morning',
      description: 'Take 5g creatine monohydrate daily with water. The most researched performance supplement — increases phosphocreatine stores for explosive power and accelerates recovery between sets.',
      scienceNote: 'Meta-analysis of 22 studies: Creatine increases lean mass by 1.4kg and strength by 8% over 12 weeks. Also improves cognitive performance under stress by 15%.',
      biomarkerTarget: 'Lean Mass ↑ · Power Output ↑ · Recovery ↑',
      impactScore: 9,
      difficulty: 'easy',
    },
    {
      id: 'phys-cold-exposure',
      name: 'Cold Exposure 2min',
      icon: '🧊',
      category: 'recovery',
      timeOfDay: 'morning',
      description: 'End shower with 2 min cold water (as cold as tolerable). Triggers norepinephrine release (2-3x baseline), reduces inflammation, and accelerates muscle recovery.',
      scienceNote: 'Soberg et al. 2022: 11 min/week cold exposure increased metabolic rate by 15%, reduced hs-CRP by 30%, and increased norepinephrine 2.5x within 4 weeks.',
      biomarkerTarget: 'hs-CRP ↓ · Testosterone ↑ · Recovery Score ↑',
      impactScore: 8,
      difficulty: 'medium',
    },
    {
      id: 'phys-protein-timing',
      name: 'Protein Timing Protocol',
      icon: '🥩',
      category: 'nutrition',
      timeOfDay: 'all-day',
      description: 'Hit 1.6g protein per kg bodyweight, distributed across 4 meals with 30-40g per meal. Maximizes muscle protein synthesis windows and prevents catabolism.',
      scienceNote: 'Schoenfeld 2018: Protein distribution across 4+ meals increased MPS by 25% vs. same total in 2 meals. Leucine threshold of 2.5g per meal is critical.',
      biomarkerTarget: 'Lean Mass ↑ · Recovery ↑ · Strain Tolerance ↑',
      impactScore: 9,
      difficulty: 'medium',
    },
  ],
  longevity: [
    {
      id: 'long-omega3',
      name: 'Omega-3 EPA/DHA 2g',
      icon: '🐟',
      category: 'supplements',
      timeOfDay: 'morning',
      description: 'Take 2g combined EPA/DHA with a fat-containing meal. The single most impactful anti-inflammatory supplement — resolves chronic low-grade inflammation at the cellular level.',
      scienceNote: 'VITAL study (25,871 participants): 2g/day Omega-3 reduced hs-CRP by 20% and cardiovascular events by 28%. Omega-3 Index >8% associated with 5-year lifespan extension.',
      biomarkerTarget: 'hs-CRP ↓ · Omega-3 Index ↑ · Inflammation ↓',
      impactScore: 10,
      difficulty: 'easy',
    },
    {
      id: 'long-sleep-architecture',
      name: 'Sleep Architecture Protocol',
      icon: '🌙',
      category: 'habits',
      timeOfDay: 'evening',
      description: 'Fixed bedtime ±30min, room at 65°F/18°C, no screens 60min before bed, no caffeine after 2pm. Optimizes deep sleep and REM for cellular repair and hormonal reset.',
      scienceNote: 'Walker 2017: Each hour of sleep below 7h increases all-cause mortality by 13%. Deep sleep drives 95% of growth hormone release — the primary anti-aging hormone.',
      biomarkerTarget: 'HRV ↑ · Biological Age ↓ · GH Release ↑',
      impactScore: 10,
      difficulty: 'medium',
    },
    {
      id: 'long-vitamin-d',
      name: 'Vitamin D3 + K2 5000IU',
      icon: '☀️',
      category: 'supplements',
      timeOfDay: 'morning',
      description: 'Take 5000IU Vitamin D3 with K2 (MK-7) with a fat-containing meal. Regulates 1,000+ genes involved in immune function, bone density, and cellular repair.',
      scienceNote: 'Autier 2014 meta-analysis: Optimal Vitamin D (40-60 ng/mL) associated with 31% reduction in all-cause mortality. 42% of US adults are deficient.',
      biomarkerTarget: 'Vitamin D ↑ · Immune Function ↑ · Bone Density ↑',
      impactScore: 9,
      difficulty: 'easy',
    },
  ],
};

/* ══════════════════════════════════════════════════════════════
   STEP INDICATOR — Minimal progress dots with glow
   ══════════════════════════════════════════════════════════════ */
function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {Array.from({ length: total }, (_, i) => {
        const isActive = i === current;
        const isDone = i < current;
        return (
          <motion.div
            key={i}
            animate={{
              width: isActive ? 28 : 8,
              background: isActive ? T.cyan : isDone ? 'rgba(0,240,255,0.4)' : 'rgba(255,255,255,0.12)',
              boxShadow: isActive ? `0 0 12px ${T.cyanDim}` : 'none',
            }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            style={{ height: 4, borderRadius: 4 }}
          />
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 1 — Primary Performance Goal
   ══════════════════════════════════════════════════════════════ */
const GOALS: {
  id: PerformanceGoal;
  label: string;
  tagline: string;
  description: string;
  icon: string;
  accent: string;
  accentDim: string;
  metrics: string[];
}[] = [
  {
    id: 'cognitive',
    label: 'Cognitive Peak',
    tagline: 'Sharpen Your Mind',
    description: 'Optimize focus, memory, and mental clarity through targeted nootropics, sleep architecture, and neuroplasticity protocols.',
    icon: '🧠',
    accent: T.purple,
    accentDim: T.purpleDim,
    metrics: ['Focus Duration', 'HRV Coherence', 'Sleep Quality'],
  },
  {
    id: 'physical',
    label: 'Physical Recovery',
    tagline: 'Build Elite Performance',
    description: 'Maximize strength, endurance, and body composition with precision nutrition, periodized training, and recovery optimization.',
    icon: '⚡',
    accent: T.cyan,
    accentDim: T.cyanDim,
    metrics: ['VO2 Max', 'Muscle Recovery', 'Strain Score'],
  },
  {
    id: 'longevity',
    label: 'Lifespan Extension',
    tagline: 'Extend Your Healthspan',
    description: 'Slow biological aging through anti-inflammatory protocols, metabolic optimization, and cellular repair strategies.',
    icon: '🧬',
    accent: T.green,
    accentDim: T.greenDim,
    metrics: ['Biological Age', 'Inflammation (CRP)', 'Telomere Health'],
  },
];

function GoalStep({
  selected,
  onSelect,
  onContinue,
}: {
  selected: PerformanceGoal | null;
  onSelect: (g: PerformanceGoal) => void;
  onContinue: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      <div style={{ textAlign: 'center' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
            background: T.cyanGlow, border: `1px solid ${T.borderActive}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 40px ${T.cyanGlow}`,
          }}
        >
          <span style={{ fontSize: 24 }}>🎯</span>
        </motion.div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.cyan, boxShadow: `0 0 8px ${T.cyanDim}` }} />
          <span style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(0,240,255,0.5)' }}>
            Step 1 of 3
          </span>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.cyan, boxShadow: `0 0 8px ${T.cyanDim}` }} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: T.text, margin: 0, letterSpacing: '-0.02em' }}>
          Primary Performance Goal
        </h1>
        <p style={{ fontSize: 12, color: T.textTer, marginTop: 8, lineHeight: 1.6 }}>
          Select the dimension you want to optimize first. Your protocols, supplements, and tracking will adapt accordingly.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {GOALS.map((goal, idx) => {
          const isSelected = selected === goal.id;
          return (
            <motion.button
              key={goal.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + idx * 0.08, duration: 0.4 }}
              onClick={() => onSelect(goal.id)}
              style={{
                width: '100%', padding: '16px 18px', borderRadius: 16, cursor: 'pointer',
                background: isSelected ? goal.accentDim : 'rgba(255,255,255,0.02)',
                border: `1.5px solid ${isSelected ? goal.accent + '50' : T.border}`,
                boxShadow: isSelected ? `0 0 30px ${goal.accentDim}, inset 0 1px 0 rgba(255,255,255,0.04)` : 'inset 0 1px 0 rgba(255,255,255,0.02)',
                textAlign: 'left', transition: 'all 0.3s ease',
                display: 'flex', gap: 14, alignItems: 'flex-start',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: isSelected ? goal.accent + '18' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isSelected ? goal.accent + '30' : 'rgba(255,255,255,0.06)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, transition: 'all 0.3s',
              }}>
                {goal.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: isSelected ? goal.accent : T.text, transition: 'color 0.3s' }}>
                    {goal.label}
                  </span>
                  <span style={{ fontSize: 10, color: isSelected ? goal.accent + 'AA' : T.textTer, fontFamily: 'monospace' }}>
                    {goal.tagline}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: T.textSec, lineHeight: 1.5, margin: 0 }}>
                  {goal.description}
                </p>
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', overflow: 'hidden' }}
                    >
                      {goal.metrics.map((m) => (
                        <span key={m} style={{
                          fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em',
                          padding: '3px 8px', borderRadius: 6,
                          background: goal.accent + '12', color: goal.accent, border: `1px solid ${goal.accent}25`,
                        }}>
                          {m}
                        </span>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                border: `2px solid ${isSelected ? goal.accent : 'rgba(255,255,255,0.12)'}`,
                background: isSelected ? goal.accent : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s',
              }}>
                {isSelected && (
                  <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="10" height="10" viewBox="0 0 10 10">
                    <path d="M2 5 L4 7 L8 3" stroke={T.bg} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </motion.svg>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      <ContinueButton enabled={!!selected} onClick={onContinue} />
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 2 — Current Supplement Stack (Multi-Select)
   ══════════════════════════════════════════════════════════════ */
const SUPPLEMENTS: { id: string; name: string; icon: string; category: string }[] = [
  { id: 'omega3', name: 'Omega-3 / Fish Oil', icon: '🐟', category: 'Foundation' },
  { id: 'vitd', name: 'Vitamin D3 + K2', icon: '☀️', category: 'Foundation' },
  { id: 'magnesium', name: 'Magnesium', icon: '🧊', category: 'Foundation' },
  { id: 'creatine', name: 'Creatine', icon: '💪', category: 'Performance' },
  { id: 'protein', name: 'Whey / Plant Protein', icon: '🥤', category: 'Performance' },
  { id: 'caffeine', name: 'Caffeine / Pre-Workout', icon: '☕', category: 'Performance' },
  { id: 'ashwagandha', name: 'Ashwagandha', icon: '🌿', category: 'Adaptogen' },
  { id: 'lions-mane', name: "Lion's Mane", icon: '🍄', category: 'Nootropic' },
  { id: 'zinc', name: 'Zinc', icon: '⚙️', category: 'Foundation' },
  { id: 'b-complex', name: 'B-Complex', icon: '💊', category: 'Foundation' },
  { id: 'collagen', name: 'Collagen', icon: '✨', category: 'Recovery' },
  { id: 'probiotics', name: 'Probiotics', icon: '🦠', category: 'Gut Health' },
  { id: 'turmeric', name: 'Turmeric / Curcumin', icon: '🟡', category: 'Anti-Inflammatory' },
  { id: 'melatonin', name: 'Melatonin', icon: '🌙', category: 'Sleep' },
  { id: 'electrolytes', name: 'Electrolytes', icon: '⚡', category: 'Hydration' },
];

function SupplementStep({
  selected,
  onToggle,
  onContinue,
  onBack,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const categories = [...new Set(SUPPLEMENTS.map((s) => s.category))];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      <div style={{ textAlign: 'center' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
            background: T.greenDim, border: `1px solid rgba(0,255,204,0.25)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 40px rgba(0,255,204,0.06)`,
          }}
        >
          <span style={{ fontSize: 24 }}>💊</span>
        </motion.div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.green, boxShadow: `0 0 8px ${T.greenDim}` }} />
          <span style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(0,255,204,0.5)' }}>
            Step 2 of 3
          </span>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.green, boxShadow: `0 0 8px ${T.greenDim}` }} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: T.text, margin: 0, letterSpacing: '-0.02em' }}>
          Current Supplement Stack
        </h1>
        <p style={{ fontSize: 12, color: T.textTer, marginTop: 8, lineHeight: 1.6 }}>
          Select everything you currently take. We will build your protocol around your existing stack.
        </p>
        {selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
              padding: '4px 12px', borderRadius: 20,
              background: T.greenDim, border: `1px solid rgba(0,255,204,0.2)`,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: T.green }}>{selected.length}</span>
            <span style={{ fontSize: 10, color: 'rgba(0,255,204,0.6)' }}>selected</span>
          </motion.div>
        )}
      </div>

      <div style={{
        maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16,
        paddingRight: 4, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent',
      }}>
        {categories.map((cat) => (
          <div key={cat}>
            <div style={{
              fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em',
              color: T.textTer, marginBottom: 8, paddingLeft: 2,
            }}>
              {cat}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SUPPLEMENTS.filter((s) => s.category === cat).map((supp) => {
                const isOn = selected.includes(supp.id);
                return (
                  <motion.button
                    key={supp.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onToggle(supp.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 12px', borderRadius: 10, cursor: 'pointer',
                      background: isOn ? T.greenDim : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isOn ? 'rgba(0,255,204,0.3)' : T.border}`,
                      boxShadow: isOn ? '0 0 16px rgba(0,255,204,0.08)' : 'none',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{supp.icon}</span>
                    <span style={{
                      fontSize: 11, fontWeight: isOn ? 600 : 400,
                      color: isOn ? T.green : T.textSec, transition: 'color 0.25s',
                    }}>
                      {supp.name}
                    </span>
                    {isOn && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        style={{
                          width: 14, height: 14, borderRadius: '50%',
                          background: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8">
                          <path d="M1.5 4 L3 5.5 L6.5 2.5" stroke={T.bg} strokeWidth="1.2" fill="none" strokeLinecap="round" />
                        </svg>
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <BackButton onClick={onBack} />
        <div style={{ flex: 1 }}>
          <ContinueButton enabled onClick={onContinue} label="Continue" />
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 3 — First Win Protocols (AI Brain Recommendations)
   
   Based on the selected goal, the AI Brain recommends 3
   high-impact protocols. All are pre-selected by default
   to minimize friction. User can deselect if desired.
   ══════════════════════════════════════════════════════════════ */
function ImpactBar({ score, color }: { score: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score * 10}%` }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
          style={{
            height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${color}60, ${color})`,
            boxShadow: `0 0 8px ${color}30`,
          }}
        />
      </div>
      <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: `${color}CC`, minWidth: 28, textAlign: 'right' }}>
        {score}/10
      </span>
    </div>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: 'easy' | 'medium' | 'hard' }) {
  const config = {
    easy: { label: 'Easy Start', color: '#00FFCC', bg: 'rgba(0,255,204,0.08)' },
    medium: { label: 'Moderate', color: '#FFB86B', bg: 'rgba(255,184,107,0.08)' },
    hard: { label: 'Advanced', color: '#FF6B6B', bg: 'rgba(255,107,107,0.08)' },
  }[difficulty];
  return (
    <span style={{
      fontSize: 8, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em',
      padding: '2px 6px', borderRadius: 4,
      background: config.bg, color: config.color, border: `1px solid ${config.color}20`,
    }}>
      {config.label}
    </span>
  );
}

function FirstWinStep({
  goal,
  selectedProtocols,
  onToggleProtocol,
  onComplete,
  onBack,
  saving,
}: {
  goal: PerformanceGoal;
  selectedProtocols: string[];
  onToggleProtocol: (id: string) => void;
  onComplete: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  const protocols = FIRST_WIN_PROTOCOLS[goal];
  const goalData = GOALS.find((g) => g.id === goal)!;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
            background: goalData.accentDim, border: `1px solid ${goalData.accent}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 40px ${goalData.accentDim}`,
          }}
        >
          <span style={{ fontSize: 24 }}>🚀</span>
        </motion.div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: goalData.accent, boxShadow: `0 0 8px ${goalData.accentDim}` }} />
          <span style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: goalData.accent + '80' }}>
            Step 3 of 3 · AI Brain Recommendations
          </span>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: goalData.accent, boxShadow: `0 0 8px ${goalData.accentDim}` }} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: T.text, margin: 0, letterSpacing: '-0.02em' }}>
          Your First Win Protocols
        </h1>
        <p style={{ fontSize: 12, color: T.textTer, marginTop: 8, lineHeight: 1.6 }}>
          Based on your <span style={{ color: goalData.accent, fontWeight: 600 }}>{goalData.label}</span> goal, here are 3 high-impact protocols to start seeing results within 7-14 days.
        </p>

        {/* AI confidence badge */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
            padding: '5px 14px', borderRadius: 20,
            background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`,
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: goalData.accent, boxShadow: `0 0 6px ${goalData.accent}60`, animation: 'pulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.textSec, letterSpacing: '0.08em' }}>
            AI BRAIN · {selectedProtocols.length} PROTOCOLS SELECTED
          </span>
        </motion.div>
      </div>

      {/* Protocol Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {protocols.map((proto, idx) => {
          const isSelected = selectedProtocols.includes(proto.id);
          const isExpanded = expandedId === proto.id;
          return (
            <motion.div
              key={proto.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + idx * 0.1, duration: 0.5 }}
              style={{
                borderRadius: 16, overflow: 'hidden',
                background: isSelected ? `${goalData.accent}06` : 'rgba(255,255,255,0.015)',
                border: `1.5px solid ${isSelected ? goalData.accent + '35' : T.border}`,
                boxShadow: isSelected ? `0 0 30px ${goalData.accentDim}, inset 0 1px 0 rgba(255,255,255,0.03)` : 'inset 0 1px 0 rgba(255,255,255,0.02)',
                transition: 'all 0.3s ease',
              }}
            >
              {/* Top accent line */}
              {isSelected && (
                <div style={{
                  height: 1,
                  background: `linear-gradient(90deg, transparent, ${goalData.accent}40, transparent)`,
                }} />
              )}

              {/* Main row */}
              <div
                style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}
                onClick={() => onToggleProtocol(proto.id)}
              >
                {/* Icon */}
                <div style={{
                  width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                  background: isSelected ? goalData.accent + '15' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? goalData.accent + '25' : 'rgba(255,255,255,0.06)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, transition: 'all 0.3s',
                }}>
                  {proto.icon}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isSelected ? goalData.accent : T.text, transition: 'color 0.3s' }}>
                      {proto.name}
                    </span>
                    <DifficultyBadge difficulty={proto.difficulty} />
                  </div>
                  <p style={{ fontSize: 11, color: T.textSec, lineHeight: 1.5, margin: '0 0 8px 0' }}>
                    {proto.description}
                  </p>

                  {/* Impact score */}
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 8, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: T.textTer }}>
                        Impact Score
                      </span>
                    </div>
                    <ImpactBar score={proto.impactScore} color={goalData.accent} />
                  </div>

                  {/* Biomarker targets */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {proto.biomarkerTarget.split(' · ').map((target) => (
                      <span key={target} style={{
                        fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.06em',
                        padding: '2px 6px', borderRadius: 4,
                        background: isSelected ? goalData.accent + '10' : 'rgba(255,255,255,0.03)',
                        color: isSelected ? goalData.accent + 'BB' : T.textTer,
                        border: `1px solid ${isSelected ? goalData.accent + '18' : 'transparent'}`,
                        transition: 'all 0.3s',
                      }}>
                        {target}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Checkbox */}
                <div style={{
                  width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 2,
                  border: `2px solid ${isSelected ? goalData.accent : 'rgba(255,255,255,0.15)'}`,
                  background: isSelected ? goalData.accent : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.3s',
                }}>
                  {isSelected && (
                    <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="12" height="12" viewBox="0 0 12 12">
                      <path d="M2.5 6 L5 8.5 L9.5 3.5" stroke={T.bg} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                  )}
                </div>
              </div>

              {/* Science expandable */}
              <div
                style={{ padding: '0 16px', cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : proto.id); }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '8px 0',
                  borderTop: `1px solid ${T.border}`,
                }}>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.08em' }}>
                    {isExpanded ? '▾' : '▸'} WHY THIS WORKS
                  </span>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{
                      padding: '0 16px 14px',
                      fontSize: 10, color: T.textSec, lineHeight: 1.6,
                      fontStyle: 'italic',
                      borderLeft: `2px solid ${goalData.accent}30`,
                      marginLeft: 16, marginRight: 16,
                      paddingLeft: 12,
                    }}>
                      {proto.scienceNote}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10 }}>
        <BackButton onClick={onBack} />
        <div style={{ flex: 1 }}>
          <ContinueButton
            enabled={selectedProtocols.length > 0 && !saving}
            onClick={onComplete}
            label={saving ? 'Deploying Protocols...' : `Deploy ${selectedProtocols.length} Protocol${selectedProtocols.length !== 1 ? 's' : ''}`}
            accent={goalData.accent}
          />
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPLETION SCREEN — Protocol Deployment Confirmation
   ══════════════════════════════════════════════════════════════ */
function CompletionScreen({ goal, protocolCount }: { goal: PerformanceGoal; protocolCount: number }) {
  const goalData = GOALS.find((g) => g.id === goal) || GOALS[0];
  const [showProtocols, setShowProtocols] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowProtocols(true), 800);
    return () => clearTimeout(t);
  }, []);

  const deployedProtocols = FIRST_WIN_PROTOCOLS[goal];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      style={{
        width: '100%', maxWidth: 420, textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
      }}
    >
      {/* Success animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
        style={{
          width: 80, height: 80, borderRadius: 24,
          background: `radial-gradient(circle at 30% 30%, ${goalData.accentDim}, transparent)`,
          border: `2px solid ${goalData.accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 60px ${goalData.accentDim}`,
        }}
      >
        <motion.svg
          width="36" height="36" viewBox="0 0 36 36"
        >
          <motion.path
            d="M8 18 L15 25 L28 11"
            stroke={goalData.accent}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          />
        </motion.svg>
      </motion.div>

      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '-0.02em' }}>
          Protocols Deployed
        </h1>
        <p style={{ fontSize: 13, color: T.textSec, marginTop: 8, lineHeight: 1.6 }}>
          {protocolCount} high-impact protocols are now active in your {goalData.label} stack. Your first win is within reach.
        </p>
      </div>

      {/* Deployed protocols summary */}
      <AnimatePresence>
        {showProtocols && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              width: '100%', padding: 16, borderRadius: 14,
              background: T.surface, border: `1px solid ${T.border}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>{goalData.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: goalData.accent }}>{goalData.label} Mode</div>
                <div style={{ fontSize: 10, color: T.textTer }}>{goalData.tagline}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {deployedProtocols.map((proto, idx) => (
                <motion.div
                  key={proto.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + idx * 0.15 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}`,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{proto.icon}</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.text }}>{proto.name}</div>
                    <div style={{ fontSize: 9, color: T.textTer, fontFamily: 'monospace' }}>{proto.timeOfDay.toUpperCase()} · {proto.category.toUpperCase()}</div>
                  </div>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: goalData.accent + '20', border: `1px solid ${goalData.accent}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <path d="M2 5 L4 7 L8 3" stroke={goalData.accent} strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    </svg>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* First win timeline */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              style={{
                marginTop: 14, padding: '10px 12px', borderRadius: 10,
                background: goalData.accent + '08', border: `1px solid ${goalData.accent}15`,
                textAlign: 'left',
              }}
            >
              <div style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.12em', color: goalData.accent + '80', marginBottom: 4 }}>
                ⏱ Expected First Win Timeline
              </div>
              <div style={{ fontSize: 11, color: T.text, fontWeight: 500 }}>
                7-14 days to measurable biomarker improvement
              </div>
              <div style={{ fontSize: 10, color: T.textSec, marginTop: 2 }}>
                Complete your daily protocols to unlock your first progress milestone.
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        style={{ fontSize: 10, color: T.textTer, fontFamily: 'monospace' }}
      >
        Redirecting to Command Center...
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SHARED BUTTONS
   ══════════════════════════════════════════════════════════════ */
function ContinueButton({
  enabled,
  onClick,
  label = 'Continue',
  accent = T.cyan,
}: {
  enabled: boolean;
  onClick: () => void;
  label?: string;
  accent?: string;
}) {
  return (
    <button
      onClick={() => enabled && onClick()}
      disabled={!enabled}
      style={{
        width: '100%', padding: '14px 0', borderRadius: 14,
        fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
        background: enabled ? accent + '15' : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${enabled ? accent + '40' : T.border}`,
        color: enabled ? accent : 'rgba(255,255,255,0.2)',
        boxShadow: enabled ? `0 0 24px ${accent}12` : 'none',
        cursor: enabled ? 'pointer' : 'not-allowed',
        transition: 'all 0.3s ease',
      }}
    >
      {label}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '14px 20px', borderRadius: 14,
        fontSize: 12, fontWeight: 500, color: T.textSec,
        background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`,
        cursor: 'pointer', transition: 'all 0.2s',
      }}
    >
      ←
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN ONBOARDING PAGE
   ══════════════════════════════════════════════════════════════ */
export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<OnboardingState>({
    goal: null,
    supplements: [],
    selectedProtocols: [],
  });
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);

  // Convex mutations
  const upsertInduction = useMutation(api.mutations.upsertInductionProfile);
  const deployProtocolTemplate = useMutation(api.mutations.deployProtocolTemplate);

  const sessionId = getTwinSessionId();

  const toggleSupplement = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      supplements: prev.supplements.includes(id)
        ? prev.supplements.filter((s) => s !== id)
        : [...prev.supplements, id],
    }));
  }, []);

  const toggleProtocol = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      selectedProtocols: prev.selectedProtocols.includes(id)
        ? prev.selectedProtocols.filter((p) => p !== id)
        : [...prev.selectedProtocols, id],
    }));
  }, []);

  // Auto-select all first-win protocols when entering step 3
  useEffect(() => {
    if (step === 2 && state.goal && state.selectedProtocols.length === 0) {
      const protocols = FIRST_WIN_PROTOCOLS[state.goal];
      setState((prev) => ({
        ...prev,
        selectedProtocols: protocols.map((p) => p.id),
      }));
    }
  }, [step, state.goal, state.selectedProtocols.length]);

  const handleComplete = useCallback(async () => {
    if (!state.goal) return;
    setSaving(true);
    try {
      // 1. Save induction profile (goal + supplements)
      const goalToNorthStar: Record<PerformanceGoal, string> = {
        cognitive: 'Optimize cognitive performance and mental clarity',
        physical: 'Build elite physical performance and body composition',
        longevity: 'Maximize healthspan and slow biological aging',
      };
      await upsertInduction({
        sessionId,
        northStar: goalToNorthStar[state.goal],
        sleepGoalHours: 8,
        primarySupplements: state.supplements,
        weightUnit: 'lbs',
      });

      // 2. Deploy selected first-win protocols to the ProtocolStack
      const allProtocols = FIRST_WIN_PROTOCOLS[state.goal];
      const selectedProtos = allProtocols.filter((p) => state.selectedProtocols.includes(p.id));

      if (selectedProtos.length > 0) {
        await deployProtocolTemplate({
          sessionId,
          templateId: `first-win-${state.goal}`,
          items: selectedProtos.map((p) => ({
            name: p.name,
            category: p.category,
            icon: p.icon,
            description: p.description,
            timeOfDay: p.timeOfDay,
          })),
        });
      }

      setComplete(true);

      // Redirect after animation
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    } catch (err) {
      console.error('Onboarding save failed:', err);
      setSaving(false);
    }
  }, [state, sessionId, upsertInduction, deployProtocolTemplate]);

  return (
    <div style={{
      minHeight: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow effects */}
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: `radial-gradient(circle, ${T.cyanGlow} 0%, transparent 70%)`,
        pointerEvents: 'none', opacity: 0.5,
      }} />
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-10%',
        width: 400, height: 400, borderRadius: '50%',
        background: `radial-gradient(circle, rgba(191,90,242,0.04) 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Vive Logo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
      >
        <span style={{
          fontSize: 18, fontWeight: 700, letterSpacing: '0.15em', color: T.text,
          textTransform: 'uppercase',
        }}>
          VIVE
        </span>
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.2em' }}>
          PERFORMANCE SYSTEM
        </span>
      </motion.div>

      {/* Step Indicator */}
      {!complete && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ marginBottom: 28 }}
        >
          <StepIndicator current={step} total={3} />
        </motion.div>
      )}

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {complete ? (
          <CompletionScreen key="complete" goal={state.goal!} protocolCount={state.selectedProtocols.length} />
        ) : step === 0 ? (
          <GoalStep
            key="goal"
            selected={state.goal}
            onSelect={(g) => setState((prev) => ({ ...prev, goal: g, selectedProtocols: [] }))}
            onContinue={() => setStep(1)}
          />
        ) : step === 1 ? (
          <SupplementStep
            key="supplements"
            selected={state.supplements}
            onToggle={toggleSupplement}
            onContinue={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        ) : (
          <FirstWinStep
            key="firstwin"
            goal={state.goal!}
            selectedProtocols={state.selectedProtocols}
            onToggleProtocol={toggleProtocol}
            onComplete={handleComplete}
            onBack={() => setStep(1)}
            saving={saving}
          />
        )}
      </AnimatePresence>

      {/* Subtle grid pattern */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.015,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }} />

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
