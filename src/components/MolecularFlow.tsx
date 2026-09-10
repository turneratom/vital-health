import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';

/* ══════════════════════════════════════════════════════════════
   MOLECULAR FLOW — High-Fidelity Interactive Onboarding
   
   5-step sequence that feels like initializing a biological OS:
   1. Mission Select — Primary longevity vector
   2. Active Interventions — Current supplements, HRT, peptides
   3. Bio-Baseline — Quick vitals capture
   4. AI Analysis — Real-time Day 1 score computation
   5. HUD Deploy — Personalized layout generation
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
  red: '#FF453A',
  redDim: 'rgba(255,69,58,0.12)',
  border: 'rgba(255,255,255,0.06)',
  borderActive: 'rgba(0,240,255,0.25)',
};

/* ── Types ── */
export type MissionGoal = 'cognitive_peak' | 'longevity_ceiling' | 'fat_loss_velocity' | 'athletic_edge';

export interface Intervention {
  id: string;
  name: string;
  icon: string;
  category: 'supplement' | 'peptide' | 'hrt' | 'nootropic' | 'adaptogen' | 'recovery';
  dosage?: string;
  frequency?: string;
}

export interface BioBaseline {
  age: number;
  weight: number;
  unit: 'lbs' | 'kg';
  sleepHours: number;
  exerciseDays: number;
  stressLevel: number; // 1-5
}

export interface Day1Score {
  overall: number;
  breakdown: {
    interventionQuality: number;
    baselineReadiness: number;
    protocolAlignment: number;
    dataCompleteness: number;
  };
  insights: string[];
  hudLayout: HUDLayout;
}

export interface HUDLayout {
  primaryWidget: string;
  secondaryWidgets: string[];
  accentColor: string;
  focusMode: string;
}

export interface MolecularState {
  mission: MissionGoal | null;
  interventions: Intervention[];
  baseline: BioBaseline;
  day1Score: Day1Score | null;
}

export interface MolecularFlowProps {
  onComplete: (state: MolecularState) => void;
  sessionId: string;
}

/* ══════════════════════════════════════════════════════════════
   INTERVENTION DATABASE — Supplements, Peptides, HRT, Nootropics
   ══════════════════════════════════════════════════════════════ */
const INTERVENTION_CATALOG: Record<string, Intervention[]> = {
  'Core Supplements': [
    { id: 'nmn', name: 'NMN', icon: '🧬', category: 'supplement', dosage: '500-1000mg', frequency: 'Daily AM' },
    { id: 'spermidine', name: 'Spermidine', icon: '🔬', category: 'supplement', dosage: '1-5mg', frequency: 'Daily AM' },
    { id: 'resveratrol', name: 'Resveratrol', icon: '🍇', category: 'supplement', dosage: '500mg', frequency: 'Daily AM' },
    { id: 'omega3', name: 'Omega-3 EPA/DHA', icon: '🐟', category: 'supplement', dosage: '2g', frequency: 'Daily' },
    { id: 'vitd3k2', name: 'Vitamin D3 + K2', icon: '☀️', category: 'supplement', dosage: '5000IU', frequency: 'Daily AM' },
    { id: 'magnesium', name: 'Magnesium Glycinate', icon: '🧊', category: 'supplement', dosage: '400mg', frequency: 'Daily PM' },
    { id: 'creatine', name: 'Creatine Monohydrate', icon: '💪', category: 'supplement', dosage: '5g', frequency: 'Daily' },
    { id: 'coq10', name: 'CoQ10 / Ubiquinol', icon: '⚡', category: 'supplement', dosage: '200mg', frequency: 'Daily' },
    { id: 'nad', name: 'NAD+ Precursor', icon: '🔋', category: 'supplement', dosage: '300mg', frequency: 'Daily AM' },
    { id: 'zinc', name: 'Zinc Picolinate', icon: '⚙️', category: 'supplement', dosage: '30mg', frequency: 'Daily' },
    { id: 'berberine', name: 'Berberine', icon: '🌿', category: 'supplement', dosage: '500mg', frequency: '2x Daily' },
    { id: 'curcumin', name: 'Curcumin / Turmeric', icon: '🟡', category: 'supplement', dosage: '500mg', frequency: 'Daily' },
  ],
  'Peptides': [
    { id: 'bpc157', name: 'BPC-157', icon: '💉', category: 'peptide', dosage: '250-500mcg', frequency: 'Daily SC' },
    { id: 'tb500', name: 'TB-500', icon: '🩹', category: 'peptide', dosage: '2.5mg', frequency: '2x/week' },
    { id: 'cjc1295', name: 'CJC-1295 / Ipamorelin', icon: '📈', category: 'peptide', dosage: '100/100mcg', frequency: 'Daily PM' },
    { id: 'ghk-cu', name: 'GHK-Cu', icon: '✨', category: 'peptide', dosage: '200mcg', frequency: 'Daily' },
    { id: 'semaglutide', name: 'Semaglutide', icon: '💊', category: 'peptide', dosage: '0.25-2.4mg', frequency: 'Weekly' },
    { id: 'tirzepatide', name: 'Tirzepatide', icon: '🎯', category: 'peptide', dosage: '2.5-15mg', frequency: 'Weekly' },
    { id: 'ss31', name: 'SS-31 (Elamipretide)', icon: '🔬', category: 'peptide', dosage: '5mg', frequency: 'Daily' },
  ],
  'HRT / Hormones': [
    { id: 'trt', name: 'Testosterone (TRT)', icon: '🔥', category: 'hrt', dosage: '100-200mg', frequency: 'Weekly' },
    { id: 'hcg', name: 'hCG', icon: '🧪', category: 'hrt', dosage: '500IU', frequency: '2x/week' },
    { id: 'dhea', name: 'DHEA', icon: '⚡', category: 'hrt', dosage: '25-50mg', frequency: 'Daily AM' },
    { id: 'pregnenolone', name: 'Pregnenolone', icon: '🧠', category: 'hrt', dosage: '50mg', frequency: 'Daily AM' },
    { id: 'thyroid', name: 'Thyroid (T3/T4)', icon: '🦋', category: 'hrt', dosage: 'Rx', frequency: 'Daily AM' },
    { id: 'progesterone', name: 'Progesterone', icon: '🌙', category: 'hrt', dosage: '100-200mg', frequency: 'Daily PM' },
  ],
  'Nootropics & Adaptogens': [
    { id: 'lions-mane', name: "Lion's Mane", icon: '🍄', category: 'nootropic', dosage: '1000mg', frequency: 'Daily AM' },
    { id: 'ashwagandha', name: 'Ashwagandha KSM-66', icon: '🌿', category: 'adaptogen', dosage: '600mg', frequency: 'Daily PM' },
    { id: 'alpha-gpc', name: 'Alpha-GPC', icon: '🧠', category: 'nootropic', dosage: '300mg', frequency: 'Daily AM' },
    { id: 'l-theanine', name: 'L-Theanine', icon: '🍵', category: 'nootropic', dosage: '200mg', frequency: 'As needed' },
    { id: 'rhodiola', name: 'Rhodiola Rosea', icon: '🏔️', category: 'adaptogen', dosage: '400mg', frequency: 'Daily AM' },
    { id: 'modafinil', name: 'Modafinil', icon: '⚡', category: 'nootropic', dosage: '100-200mg', frequency: 'As needed' },
    { id: 'methylene-blue', name: 'Methylene Blue', icon: '💎', category: 'nootropic', dosage: '0.5-1mg/kg', frequency: 'Cycling' },
  ],
  'Recovery Protocols': [
    { id: 'cold-plunge', name: 'Cold Plunge', icon: '🧊', category: 'recovery', dosage: '2-5min', frequency: 'Daily AM' },
    { id: 'sauna', name: 'Sauna (IR/Finnish)', icon: '🔥', category: 'recovery', dosage: '20-30min', frequency: '3-4x/week' },
    { id: 'red-light', name: 'Red Light Therapy', icon: '🔴', category: 'recovery', dosage: '10-20min', frequency: 'Daily' },
    { id: 'hyperbaric', name: 'Hyperbaric O2', icon: '🫧', category: 'recovery', dosage: '60min', frequency: '2-3x/week' },
    { id: 'zone2', name: 'Zone 2 Cardio', icon: '🏃', category: 'recovery', dosage: '30-60min', frequency: '3-4x/week' },
    { id: 'breathwork', name: 'Breathwork / Wim Hof', icon: '🌬️', category: 'recovery', dosage: '10-20min', frequency: 'Daily AM' },
  ],
};

/* ══════════════════════════════════════════════════════════════
   MISSION DATA
   ══════════════════════════════════════════════════════════════ */
const MISSIONS: {
  id: MissionGoal;
  label: string;
  tagline: string;
  description: string;
  icon: string;
  accent: string;
  accentDim: string;
  biomarkers: string[];
  hudFocus: string;
}[] = [
  {
    id: 'cognitive_peak',
    label: 'Cognitive Peak',
    tagline: 'Maximum Neural Output',
    description: 'Optimize focus, memory, and neuroplasticity. Target BDNF upregulation, acetylcholine synthesis, and deep sleep architecture for sustained cognitive dominance.',
    icon: '🧠',
    accent: T.purple,
    accentDim: T.purpleDim,
    biomarkers: ['BDNF', 'HRV Coherence', 'Deep Sleep %', 'Focus Duration'],
    hudFocus: 'cognitive',
  },
  {
    id: 'longevity_ceiling',
    label: 'Longevity Ceiling',
    tagline: 'Reverse Biological Age',
    description: 'Slow and reverse biological aging through NAD+ optimization, senolytic protocols, telomere preservation, and systemic inflammation reduction.',
    icon: '🧬',
    accent: T.green,
    accentDim: T.greenDim,
    biomarkers: ['Biological Age', 'hs-CRP', 'Telomere Length', 'NAD+ Levels'],
    hudFocus: 'longevity',
  },
  {
    id: 'fat_loss_velocity',
    label: 'Fat-Loss Velocity',
    tagline: 'Metabolic Optimization',
    description: 'Accelerate fat oxidation through GLP-1 pathway activation, insulin sensitivity protocols, metabolic flexibility training, and thermogenic compound stacking.',
    icon: '🔥',
    accent: T.orange,
    accentDim: T.orangeDim,
    biomarkers: ['Body Comp %', 'Fasting Insulin', 'HbA1c', 'RMR'],
    hudFocus: 'metabolic',
  },
  {
    id: 'athletic_edge',
    label: 'Athletic Edge',
    tagline: 'Elite Physical Output',
    description: 'Maximize VO2 max, power output, and recovery velocity through periodized training, mitochondrial biogenesis, and anabolic hormone optimization.',
    icon: '⚡',
    accent: T.cyan,
    accentDim: T.cyanDim,
    biomarkers: ['VO2 Max', 'Testosterone', 'Recovery Score', 'Strain Capacity'],
    hudFocus: 'performance',
  },
];

/* ══════════════════════════════════════════════════════════════
   DAY 1 SCORE ALGORITHM
   ══════════════════════════════════════════════════════════════ */
function computeDay1Score(
  mission: MissionGoal,
  interventions: Intervention[],
  baseline: BioBaseline,
): Day1Score {
  const missionData = MISSIONS.find(m => m.id === mission)!;

  // 1. Intervention Quality Score (0-100)
  // More interventions = higher, but with diminishing returns
  // Category diversity bonus
  const categories = new Set(interventions.map(i => i.category));
  const categoryBonus = Math.min(categories.size * 8, 40);
  const countScore = Math.min(interventions.length * 6, 50);
  
  // Mission alignment bonus
  const missionAligned: Record<MissionGoal, string[]> = {
    cognitive_peak: ['lions-mane', 'alpha-gpc', 'l-theanine', 'nmn', 'magnesium', 'omega3', 'modafinil', 'methylene-blue', 'cold-plunge', 'breathwork'],
    longevity_ceiling: ['nmn', 'spermidine', 'resveratrol', 'omega3', 'vitd3k2', 'coq10', 'nad', 'berberine', 'curcumin', 'sauna', 'zone2', 'ss31'],
    fat_loss_velocity: ['semaglutide', 'tirzepatide', 'berberine', 'zone2', 'cold-plunge', 'creatine', 'l-theanine', 'sauna'],
    athletic_edge: ['creatine', 'bpc157', 'tb500', 'trt', 'cold-plunge', 'zone2', 'red-light', 'coq10', 'ashwagandha'],
  };
  const alignedCount = interventions.filter(i => missionAligned[mission].includes(i.id)).length;
  const alignmentBonus = Math.min(alignedCount * 5, 30);
  const interventionQuality = Math.min(Math.round(countScore + categoryBonus * 0.3 + alignmentBonus * 0.7), 100);

  // 2. Baseline Readiness Score (0-100)
  let baselineReadiness = 50;
  // Sleep
  if (baseline.sleepHours >= 8) baselineReadiness += 15;
  else if (baseline.sleepHours >= 7) baselineReadiness += 10;
  else if (baseline.sleepHours < 6) baselineReadiness -= 10;
  // Exercise
  if (baseline.exerciseDays >= 5) baselineReadiness += 15;
  else if (baseline.exerciseDays >= 3) baselineReadiness += 10;
  else if (baseline.exerciseDays <= 1) baselineReadiness -= 5;
  // Stress
  if (baseline.stressLevel <= 2) baselineReadiness += 10;
  else if (baseline.stressLevel >= 4) baselineReadiness -= 10;
  // Age factor
  if (baseline.age >= 25 && baseline.age <= 45) baselineReadiness += 10;
  else if (baseline.age > 55) baselineReadiness += 5; // bonus for proactive aging
  baselineReadiness = Math.max(20, Math.min(100, baselineReadiness));

  // 3. Protocol Alignment (0-100) — how well interventions match mission
  const protocolAlignment = Math.min(Math.round(
    (alignedCount / Math.max(missionAligned[mission].length, 1)) * 100
  ), 100);

  // 4. Data Completeness (0-100)
  let dataCompleteness = 30; // base for completing onboarding
  if (baseline.age > 0) dataCompleteness += 15;
  if (baseline.weight > 0) dataCompleteness += 15;
  if (interventions.length > 0) dataCompleteness += 20;
  if (baseline.sleepHours > 0) dataCompleteness += 10;
  if (baseline.exerciseDays >= 0) dataCompleteness += 10;
  dataCompleteness = Math.min(dataCompleteness, 100);

  // Overall weighted score
  const overall = Math.round(
    interventionQuality * 0.30 +
    baselineReadiness * 0.30 +
    protocolAlignment * 0.20 +
    dataCompleteness * 0.20
  );

  // Generate insights
  const insights: string[] = [];
  if (alignedCount >= 3) {
    insights.push(`${alignedCount} interventions directly aligned with ${missionData.label} — strong protocol-mission coherence.`);
  } else if (alignedCount === 0) {
    insights.push(`No mission-aligned interventions detected. Adding ${missionAligned[mission].slice(0, 2).join(' or ')} would significantly boost your ${missionData.label} trajectory.`);
  }
  if (baseline.sleepHours < 7) {
    insights.push('Sleep below 7h is the #1 bottleneck for all longevity vectors. Prioritize sleep architecture before stacking interventions.');
  }
  if (categories.has('peptide') && categories.has('supplement')) {
    insights.push('Peptide + supplement stack detected — monitor for synergistic effects on recovery biomarkers within 14 days.');
  }
  if (baseline.stressLevel >= 4) {
    insights.push('Elevated stress is suppressing HRV and cortisol rhythm. Adding adaptogen protocols (Ashwagandha, Rhodiola) is recommended.');
  }
  if (interventions.length >= 8) {
    insights.push(`${interventions.length} active interventions — consider cycling protocols to prevent receptor downregulation.`);
  }
  if (insights.length === 0) {
    insights.push('Baseline established. Upload blood work and connect wearables to unlock precision protocol recommendations.');
  }

  // HUD Layout based on mission
  const hudLayouts: Record<MissionGoal, HUDLayout> = {
    cognitive_peak: {
      primaryWidget: 'Focus Timer + HRV Coherence',
      secondaryWidgets: ['Sleep Architecture', 'Nootropic Stack', 'Deep Work Sessions'],
      accentColor: T.purple,
      focusMode: 'cognitive',
    },
    longevity_ceiling: {
      primaryWidget: 'Biological Age Delta',
      secondaryWidgets: ['Biomarker Trends', 'Supplement Adherence', 'Inflammation Score'],
      accentColor: T.green,
      focusMode: 'longevity',
    },
    fat_loss_velocity: {
      primaryWidget: 'Metabolic Rate + Body Comp',
      secondaryWidgets: ['Glucose Trends', 'Caloric Balance', 'Zone 2 Minutes'],
      accentColor: T.orange,
      focusMode: 'metabolic',
    },
    athletic_edge: {
      primaryWidget: 'Recovery Score + Strain',
      secondaryWidgets: ['VO2 Max Trend', 'Training Load', 'Hormone Panel'],
      accentColor: T.cyan,
      focusMode: 'performance',
    },
  };

  return {
    overall,
    breakdown: {
      interventionQuality,
      baselineReadiness,
      protocolAlignment,
      dataCompleteness,
    },
    insights,
    hudLayout: hudLayouts[mission],
  };
}

/* ══════════════════════════════════════════════════════════════
   DNA HELIX BACKGROUND — Animated molecular pattern
   ══════════════════════════════════════════════════════════════ */
function MolecularBG({ accent = T.cyan }: { accent?: string }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {/* Central glow */}
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: 700, height: 700, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}08 0%, transparent 70%)`,
      }} />
      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.02,
        backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
        backgroundSize: '48px 48px',
      }} />
      {/* Floating particles */}
      {Array.from({ length: 12 }, (_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [0, -30, 0],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 4 + i * 0.5,
            repeat: Infinity,
            delay: i * 0.3,
          }}
          style={{
            position: 'absolute',
            left: `${8 + (i * 7.5) % 85}%`,
            top: `${15 + (i * 13) % 70}%`,
            width: 3,
            height: 3,
            borderRadius: '50%',
            background: accent,
            boxShadow: `0 0 8px ${accent}40`,
          }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP PROGRESS BAR — Molecular chain visualization
   ══════════════════════════════════════════════════════════════ */
function MolecularProgress({ step, total, accent }: { step: number; total: number; accent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {Array.from({ length: total }, (_, i) => {
        const isActive = i === step;
        const isDone = i < step;
        return (
          <React.Fragment key={i}>
            <motion.div
              animate={{
                width: isActive ? 12 : 8,
                height: isActive ? 12 : 8,
                background: isActive ? accent : isDone ? accent + '80' : 'rgba(255,255,255,0.12)',
                boxShadow: isActive ? `0 0 16px ${accent}50` : 'none',
              }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              style={{ borderRadius: '50%', flexShrink: 0 }}
            />
            {i < total - 1 && (
              <motion.div
                animate={{
                  background: isDone ? `linear-gradient(90deg, ${accent}60, ${accent}30)` : 'rgba(255,255,255,0.06)',
                }}
                style={{ height: 2, width: 24, borderRadius: 1, flexShrink: 0 }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 1 — MISSION SELECT
   ══════════════════════════════════════════════════════════════ */
function MissionStep({
  selected,
  onSelect,
  onContinue,
}: {
  selected: MissionGoal | null;
  onSelect: (m: MissionGoal) => void;
  onContinue: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      <div style={{ textAlign: 'center' }}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          style={{ fontSize: 36, marginBottom: 12 }}
        >
          🎯
        </motion.div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '-0.03em' }}>
          Select Your Mission Vector
        </h1>
        <p style={{ fontSize: 12, color: T.textTer, marginTop: 8, lineHeight: 1.6 }}>
          Your primary optimization target. The AI Brain will architect every protocol, supplement, and metric around this vector.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MISSIONS.map((m, idx) => {
          const isSelected = selected === m.id;
          return (
            <motion.button
              key={m.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + idx * 0.06 }}
              onClick={() => onSelect(m.id)}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                background: isSelected ? m.accentDim : 'rgba(255,255,255,0.015)',
                border: `1.5px solid ${isSelected ? m.accent + '45' : T.border}`,
                boxShadow: isSelected ? `0 0 30px ${m.accentDim}` : 'none',
                textAlign: 'left', display: 'flex', gap: 12, alignItems: 'center',
                transition: 'all 0.25s ease',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: isSelected ? m.accent + '18' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isSelected ? m.accent + '30' : 'rgba(255,255,255,0.06)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>
                {m.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: isSelected ? m.accent : T.text }}>{m.label}</span>
                  <span style={{ fontSize: 9, fontFamily: 'monospace', color: isSelected ? m.accent + 'AA' : T.textTer }}>{m.tagline}</span>
                </div>
                <p style={{ fontSize: 11, color: T.textSec, lineHeight: 1.4, margin: '4px 0 0' }}>{m.description}</p>
                <AnimatePresence>
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap', overflow: 'hidden' }}
                    >
                      {m.biomarkers.map(b => (
                        <span key={b} style={{
                          fontSize: 8, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em',
                          padding: '2px 7px', borderRadius: 5,
                          background: m.accent + '12', color: m.accent, border: `1px solid ${m.accent}20`,
                        }}>{b}</span>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${isSelected ? m.accent : 'rgba(255,255,255,0.12)'}`,
                background: isSelected ? m.accent : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isSelected && (
                  <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="10" height="10" viewBox="0 0 10 10">
                    <path d="M2 5 L4 7 L8 3" stroke={T.bg} strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </motion.svg>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      <NavButton enabled={!!selected} onClick={onContinue} label="Initialize Mission" accent={selected ? MISSIONS.find(m => m.id === selected)!.accent : T.cyan} />
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 2 — ACTIVE INTERVENTIONS (Swipe-to-add gesture cards)
   ══════════════════════════════════════════════════════════════ */
function InterventionCard({
  item,
  isActive,
  onToggle,
  accent,
}: {
  item: Intervention;
  isActive: boolean;
  onToggle: () => void;
  accent: string;
}) {
  const x = useMotionValue(0);
  const bg = useTransform(x, [-80, 0, 80], [
    'rgba(255,69,58,0.15)',
    isActive ? accent + '10' : 'rgba(255,255,255,0.015)',
    accent + '20',
  ]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 50) {
      onToggle();
    }
  };

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.3}
      onDragEnd={handleDragEnd}
      style={{ x, background: bg }}
      whileTap={{ scale: 0.98 }}
      onClick={onToggle}
      className="intervention-card"
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
        border: `1px solid ${isActive ? accent + '30' : T.border}`,
        boxShadow: isActive ? `0 0 12px ${accent}10` : 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}>
        <span style={{ fontSize: 16 }}>{item.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? accent : T.text }}>{item.name}</div>
          {item.dosage && (
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer }}>{item.dosage} · {item.frequency}</div>
          )}
        </div>
        <div style={{
          width: 18, height: 18, borderRadius: 5, flexShrink: 0,
          border: `1.5px solid ${isActive ? accent : 'rgba(255,255,255,0.15)'}`,
          background: isActive ? accent : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}>
          {isActive && (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 5 L4 7 L8 3" stroke={T.bg} strokeWidth="1.5" fill="none" strokeLinecap="round" />
            </svg>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function InterventionStep({
  selected,
  onToggle,
  onContinue,
  onBack,
  accent,
}: {
  selected: Intervention[];
  onToggle: (item: Intervention) => void;
  onContinue: () => void;
  onBack: () => void;
  accent: string;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCat, setExpandedCat] = useState<string | null>('Core Supplements');
  const selectedIds = new Set(selected.map(s => s.id));

  const filteredCatalog = Object.entries(INTERVENTION_CATALOG).map(([cat, items]) => ({
    cat,
    items: searchQuery
      ? items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : items,
  })).filter(({ items }) => items.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5 }}
      style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <div style={{ textAlign: 'center' }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ fontSize: 36, marginBottom: 12 }}>💉</motion.div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '-0.03em' }}>
          Active Interventions
        </h1>
        <p style={{ fontSize: 12, color: T.textTer, marginTop: 8, lineHeight: 1.6 }}>
          Select everything you currently take or do. Supplements, peptides, HRT, recovery protocols — the AI Brain needs your full stack.
        </p>
        {selected.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10,
              padding: '4px 14px', borderRadius: 20,
              background: accent + '15', border: `1px solid ${accent}25`,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: accent }}>{selected.length}</span>
            <span style={{ fontSize: 10, color: accent + 'AA' }}>active interventions</span>
          </motion.div>
        )}
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderRadius: 10,
        background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`,
      }}>
        <span style={{ fontSize: 14, opacity: 0.4 }}>🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search interventions..."
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: T.text, fontSize: 12, fontFamily: 'inherit',
          }}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: T.textTer, cursor: 'pointer', fontSize: 12 }}>✕</button>
        )}
      </div>

      {/* Catalog */}
      <div style={{
        maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8,
        paddingRight: 4, scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent',
      }}>
        {filteredCatalog.map(({ cat, items }) => (
          <div key={cat}>
            <button
              onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 4px', background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{
                fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em',
                color: T.textTer,
              }}>
                {cat}
              </span>
              <span style={{ fontSize: 9, color: T.textTer }}>
                {items.filter(i => selectedIds.has(i.id)).length}/{items.length} · {expandedCat === cat ? '▾' : '▸'}
              </span>
            </button>
            <AnimatePresence>
              {(expandedCat === cat || searchQuery) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 4 }}
                >
                  {items.map(item => (
                    <InterventionCard
                      key={item.id}
                      item={item}
                      isActive={selectedIds.has(item.id)}
                      onToggle={() => onToggle(item)}
                      accent={accent}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <BackBtn onClick={onBack} />
        <div style={{ flex: 1 }}>
          <NavButton enabled onClick={onContinue} label="Continue" accent={accent} />
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 3 — BIO-BASELINE (Quick vitals capture)
   ══════════════════════════════════════════════════════════════ */
function BaselineStep({
  baseline,
  onChange,
  onContinue,
  onBack,
  accent,
}: {
  baseline: BioBaseline;
  onChange: (b: Partial<BioBaseline>) => void;
  onContinue: () => void;
  onBack: () => void;
  accent: string;
}) {
  const stressLabels = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5 }}
      style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      <div style={{ textAlign: 'center' }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ fontSize: 36, marginBottom: 12 }}>📊</motion.div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '-0.03em' }}>
          Bio-Baseline Capture
        </h1>
        <p style={{ fontSize: 12, color: T.textTer, marginTop: 8, lineHeight: 1.6 }}>
          Quick vitals to calibrate your Day 1 Longevity Score. Precision improves as you add wearable data.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Age + Weight row */}
        <div style={{ display: 'flex', gap: 10 }}>
          <InputField label="Age" value={baseline.age || ''} onChange={v => onChange({ age: Number(v) || 0 })} suffix="yrs" accent={accent} />
          <InputField label="Weight" value={baseline.weight || ''} onChange={v => onChange({ weight: Number(v) || 0 })} suffix={baseline.unit} accent={accent} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textTer }}>Unit</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['lbs', 'kg'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => onChange({ unit: u })}
                  style={{
                    padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                    background: baseline.unit === u ? accent + '15' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${baseline.unit === u ? accent + '30' : T.border}`,
                    color: baseline.unit === u ? accent : T.textSec,
                    fontSize: 11, fontWeight: 600,
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sleep */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textTer }}>
              Average Sleep
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{baseline.sleepHours}h</span>
          </div>
          <input
            type="range"
            min={4}
            max={10}
            step={0.5}
            value={baseline.sleepHours}
            onChange={e => onChange({ sleepHours: Number(e.target.value) })}
            style={{ width: '100%', accentColor: accent }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 9, color: T.textTer }}>4h</span>
            <span style={{ fontSize: 9, color: T.textTer }}>10h</span>
          </div>
        </div>

        {/* Exercise Days */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textTer }}>
              Exercise Days / Week
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{baseline.exerciseDays}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map(d => (
              <button
                key={d}
                onClick={() => onChange({ exerciseDays: d })}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                  background: baseline.exerciseDays === d ? accent + '20' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${baseline.exerciseDays === d ? accent + '40' : T.border}`,
                  color: baseline.exerciseDays === d ? accent : T.textSec,
                  fontSize: 12, fontWeight: baseline.exerciseDays === d ? 700 : 400,
                  transition: 'all 0.2s',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Stress Level */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textTer }}>
              Perceived Stress
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color: baseline.stressLevel >= 4 ? T.orange : accent }}>
              {stressLabels[baseline.stressLevel - 1]}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(s => {
              const isActive = baseline.stressLevel === s;
              const stressColor = s >= 4 ? T.orange : s >= 3 ? '#FFD60A' : T.green;
              return (
                <button
                  key={s}
                  onClick={() => onChange({ stressLevel: s })}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                    background: isActive ? stressColor + '18' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isActive ? stressColor + '40' : T.border}`,
                    color: isActive ? stressColor : T.textSec,
                    fontSize: 14, fontWeight: isActive ? 700 : 400,
                    transition: 'all 0.2s',
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <BackBtn onClick={onBack} />
        <div style={{ flex: 1 }}>
          <NavButton enabled={baseline.age > 0 && baseline.weight > 0} onClick={onContinue} label="Analyze" accent={accent} />
        </div>
      </div>
    </motion.div>
  );
}

function InputField({ label, value, onChange, suffix, accent }: {
  label: string; value: string | number; onChange: (v: string) => void; suffix: string; accent: string;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: T.textTer }}>{label}</span>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '8px 12px', borderRadius: 8,
        background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`,
      }}>
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: T.text, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', width: '100%',
          }}
        />
        <span style={{ fontSize: 10, color: T.textTer }}>{suffix}</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 4 — AI ANALYSIS (Animated Day 1 Score computation)
   ══════════════════════════════════════════════════════════════ */
function AnalysisStep({
  score,
  mission,
  interventionCount,
  onContinue,
  accent,
}: {
  score: Day1Score;
  mission: MissionGoal;
  interventionCount: number;
  onContinue: () => void;
  accent: string;
}) {
  const [phase, setPhase] = useState(0); // 0=scanning, 1=computing, 2=revealed
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1200);
    const t2 = setTimeout(() => setPhase(2), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    if (phase < 2) return;
    let current = 0;
    const target = score.overall;
    const interval = setInterval(() => {
      current += Math.ceil((target - current) * 0.12);
      if (current >= target) { current = target; clearInterval(interval); }
      setDisplayScore(current);
    }, 30);
    return () => clearInterval(interval);
  }, [phase, score.overall]);

  const missionData = MISSIONS.find(m => m.id === mission)!;

  const breakdownItems = [
    { label: 'Intervention Quality', value: score.breakdown.interventionQuality, icon: '💊' },
    { label: 'Baseline Readiness', value: score.breakdown.baselineReadiness, icon: '📊' },
    { label: 'Protocol Alignment', value: score.breakdown.protocolAlignment, icon: '🎯' },
    { label: 'Data Completeness', value: score.breakdown.dataCompleteness, icon: '📡' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5 }}
      style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}
    >
      {/* Score Ring */}
      <div style={{ position: 'relative', width: 160, height: 160 }}>
        <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="80" cy="80" r="68" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
          <motion.circle
            cx="80" cy="80" r="68" fill="none" stroke={accent} strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 68}
            initial={{ strokeDashoffset: 2 * Math.PI * 68 }}
            animate={{ strokeDashoffset: phase >= 2 ? 2 * Math.PI * 68 * (1 - score.overall / 100) : 2 * Math.PI * 68 }}
            transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
            style={{ filter: `drop-shadow(0 0 8px ${accent}60)` }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <AnimatePresence mode="wait">
            {phase < 2 ? (
              <motion.div key="scanning" exit={{ opacity: 0 }} style={{ textAlign: 'center' }}>
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  style={{ fontSize: 10, fontFamily: 'monospace', color: accent, letterSpacing: '0.15em' }}
                >
                  {phase === 0 ? 'SCANNING STACK...' : 'COMPUTING SCORE...'}
                </motion.div>
              </motion.div>
            ) : (
              <motion.div key="score" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 42, fontWeight: 800, color: T.text, letterSpacing: '-0.04em', lineHeight: 1 }}>
                  {displayScore}
                </div>
                <div style={{ fontSize: 9, fontFamily: 'monospace', color: accent, letterSpacing: '0.15em', marginTop: 4 }}>
                  DAY 1 SCORE
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mission + Stack Summary */}
      <AnimatePresence>
        {phase >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              padding: '10px 16px', borderRadius: 12,
              background: accent + '08', border: `1px solid ${accent}15`,
            }}>
              <span style={{ fontSize: 20 }}>{missionData.icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: accent }}>{missionData.label}</div>
                <div style={{ fontSize: 9, color: T.textTer, fontFamily: 'monospace' }}>{interventionCount} ACTIVE INTERVENTIONS</div>
              </div>
            </div>

            {/* Breakdown bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {breakdownItems.map((item, idx) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + idx * 0.1 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12 }}>{item.icon}</span>
                      <span style={{ fontSize: 10, color: T.textSec }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: accent }}>{item.value}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.value}%` }}
                      transition={{ duration: 0.8, delay: 0.8 + idx * 0.1, ease: [0.4, 0, 0.2, 1] }}
                      style={{
                        height: '100%', borderRadius: 2,
                        background: `linear-gradient(90deg, ${accent}60, ${accent})`,
                        boxShadow: `0 0 6px ${accent}30`,
                      }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* AI Insights */}
            <div style={{
              padding: 14, borderRadius: 12,
              background: T.surface, border: `1px solid ${T.border}`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', background: accent,
                  boxShadow: `0 0 6px ${accent}60`,
                  animation: 'pulse 2s ease-in-out infinite',
                }} />
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: accent, letterSpacing: '0.12em' }}>
                  AI BRAIN ANALYSIS
                </span>
              </div>
              {score.insights.map((insight, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2 + i * 0.2 }}
                  style={{
                    fontSize: 11, color: T.textSec, lineHeight: 1.6, margin: i > 0 ? '8px 0 0' : 0,
                    paddingLeft: 10, borderLeft: `2px solid ${accent}25`,
                  }}
                >
                  {insight}
                </motion.p>
              ))}
            </div>

            <NavButton enabled onClick={onContinue} label="Deploy HUD" accent={accent} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 5 — HUD DEPLOY (Personalized layout generation)
   ══════════════════════════════════════════════════════════════ */
function HUDDeployStep({
  score,
  mission,
  onComplete,
  accent,
}: {
  score: Day1Score;
  mission: MissionGoal;
  onComplete: () => void;
  accent: string;
}) {
  const [deployPhase, setDeployPhase] = useState(0);
  const missionData = MISSIONS.find(m => m.id === mission)!;
  const phases = [
    'Initializing Protocol Engine...',
    'Calibrating Biomarker Thresholds...',
    `Deploying ${missionData.label} HUD Layout...`,
    'Activating AI Brain Monitoring...',
    'System Online ✓',
  ];

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    phases.forEach((_, i) => {
      timers.push(setTimeout(() => setDeployPhase(i), 600 + i * 700));
    });
    timers.push(setTimeout(() => onComplete(), 600 + phases.length * 700 + 1200));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      style={{
        width: '100%', maxWidth: 420, textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
      }}
    >
      {/* Animated orb */}
      <motion.div
        animate={{
          boxShadow: [
            `0 0 40px ${accent}20`,
            `0 0 80px ${accent}40`,
            `0 0 40px ${accent}20`,
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          width: 80, height: 80, borderRadius: 24,
          background: `radial-gradient(circle at 30% 30%, ${accent}25, ${accent}08)`,
          border: `2px solid ${accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 36 }}>{missionData.icon}</span>
      </motion.div>

      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0 }}>
          Deploying Your OS
        </h1>
        <p style={{ fontSize: 12, color: T.textSec, marginTop: 6 }}>
          {missionData.label} Mode · Day 1 Score: {score.overall}/100
        </p>
      </div>

      {/* Deploy phases */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {phases.map((phase, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: deployPhase >= i ? 1 : 0.2, x: deployPhase >= i ? 0 : -10 }}
            transition={{ duration: 0.3 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 8,
              background: deployPhase >= i ? accent + '06' : 'transparent',
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              background: deployPhase > i ? accent + '20' : deployPhase === i ? accent + '10' : 'transparent',
              border: `1.5px solid ${deployPhase >= i ? accent + '40' : 'rgba(255,255,255,0.08)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {deployPhase > i ? (
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M2 5 L4 7 L8 3" stroke={accent} strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
              ) : deployPhase === i ? (
                <motion.div
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: accent }}
                />
              ) : null}
            </div>
            <span style={{
              fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.03em',
              color: deployPhase >= i ? T.text : T.textTer,
            }}>
              {phase}
            </span>
          </motion.div>
        ))}
      </div>

      {/* HUD Layout Preview */}
      <AnimatePresence>
        {deployPhase >= phases.length - 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{
              width: '100%', padding: 14, borderRadius: 12,
              background: T.surface, border: `1px solid ${accent}15`,
            }}
          >
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: accent, letterSpacing: '0.12em', marginBottom: 10 }}>
              PERSONALIZED HUD LAYOUT
            </div>
            <div style={{
              padding: '8px 10px', borderRadius: 8, marginBottom: 8,
              background: accent + '08', border: `1px solid ${accent}15`,
            }}>
              <div style={{ fontSize: 10, color: T.textTer, fontFamily: 'monospace' }}>PRIMARY WIDGET</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginTop: 2 }}>{score.hudLayout.primaryWidget}</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {score.hudLayout.secondaryWidgets.map(w => (
                <span key={w} style={{
                  fontSize: 9, padding: '4px 8px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`,
                  color: T.textSec,
                }}>
                  {w}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ══════════════════════════════════════════════════════════════ */
function NavButton({ enabled, onClick, label, accent }: {
  enabled: boolean; onClick: () => void; label: string; accent: string;
}) {
  return (
    <motion.button
      whileTap={enabled ? { scale: 0.97 } : {}}
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
    </motion.button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '14px 20px', borderRadius: 14,
        fontSize: 12, fontWeight: 500, color: T.textSec,
        background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`,
        cursor: 'pointer',
      }}
    >
      ←
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN MOLECULAR FLOW COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function MolecularFlow({ onComplete, sessionId }: MolecularFlowProps) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<MolecularState>({
    mission: null,
    interventions: [],
    baseline: { age: 0, weight: 0, unit: 'lbs', sleepHours: 7, exerciseDays: 3, stressLevel: 3 },
    day1Score: null,
  });

  const totalSteps = 5;
  const missionData = state.mission ? MISSIONS.find(m => m.id === state.mission) : null;
  const accent = missionData?.accent || T.cyan;

  const toggleIntervention = useCallback((item: Intervention) => {
    setState(prev => ({
      ...prev,
      interventions: prev.interventions.find(i => i.id === item.id)
        ? prev.interventions.filter(i => i.id !== item.id)
        : [...prev.interventions, item],
    }));
  }, []);

  const updateBaseline = useCallback((partial: Partial<BioBaseline>) => {
    setState(prev => ({
      ...prev,
      baseline: { ...prev.baseline, ...partial },
    }));
  }, []);

  const handleAnalyze = useCallback(() => {
    if (!state.mission) return;
    const score = computeDay1Score(state.mission, state.interventions, state.baseline);
    setState(prev => ({ ...prev, day1Score: score }));
    setStep(3);
  }, [state.mission, state.interventions, state.baseline]);

  const handleDeploy = useCallback(() => {
    setStep(4);
  }, []);

  const handleComplete = useCallback(() => {
    onComplete(state);
  }, [state, onComplete]);

  return (
    <div style={{
      minHeight: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '40px 20px',
      position: 'relative', overflow: 'hidden',
    }}>
      <MolecularBG accent={accent} />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 1 }}
      >
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: '0.15em', color: T.text, textTransform: 'uppercase' }}>
          VIVE
        </span>
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.2em' }}>
          MOLECULAR ONBOARDING
        </span>
      </motion.div>

      {/* Progress */}
      {step < 4 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 24, zIndex: 1 }}>
          <MolecularProgress step={step} total={totalSteps} accent={accent} />
        </motion.div>
      )}

      {/* Step Content */}
      <div style={{ zIndex: 1, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          {step === 0 && (
            <MissionStep
              key="mission"
              selected={state.mission}
              onSelect={m => setState(prev => ({ ...prev, mission: m, interventions: [] }))}
              onContinue={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <InterventionStep
              key="interventions"
              selected={state.interventions}
              onToggle={toggleIntervention}
              onContinue={() => setStep(2)}
              onBack={() => setStep(0)}
              accent={accent}
            />
          )}
          {step === 2 && (
            <BaselineStep
              key="baseline"
              baseline={state.baseline}
              onChange={updateBaseline}
              onContinue={handleAnalyze}
              onBack={() => setStep(1)}
              accent={accent}
            />
          )}
          {step === 3 && state.day1Score && (
            <AnalysisStep
              key="analysis"
              score={state.day1Score}
              mission={state.mission!}
              interventionCount={state.interventions.length}
              onContinue={handleDeploy}
              accent={accent}
            />
          )}
          {step === 4 && state.day1Score && (
            <HUDDeployStep
              key="deploy"
              score={state.day1Score}
              mission={state.mission!}
              onComplete={handleComplete}
              accent={accent}
            />
          )}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        input[type="range"] {
          -webkit-appearance: none;
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.08);
          outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${accent};
          cursor: pointer;
          box-shadow: 0 0 10px ${accent}40;
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}
