import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

import { getTwinSessionId } from '@/lib/twinSession'
/* ══════════════════════════════════════════════════════════════
   ONBOARDING SCANNER — 4-Step Interactive Bio-Initialization
   
   Step 1: Bio-Scanner (age, weight, gender, goals)
   Step 2: Lab Integration (upload labs / sync Apple Health)
   Step 3: Protocol Selection (Peptides, TRT, Holistic)
   Step 4: Bio-Reveal (AI Vitality Score + biological age)
   
   Medical OS aesthetic: dark mode, subtle glows, crisp type.
   ══════════════════════════════════════════════════════════════ */

const T = {
  bg: '#06060A',
  surface: 'rgba(12,12,18,0.88)',
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
  red: '#FF6B6B',
  border: 'rgba(255,255,255,0.06)',
  borderActive: 'rgba(0,240,255,0.25)',
};

const STEP_META = [
  { label: 'BIO-SCANNER', icon: '🧬', accent: T.cyan },
  { label: 'LAB INTEGRATION', icon: '🔬', accent: T.green },
  { label: 'PROTOCOL SELECTION', icon: '⚗️', accent: T.purple },
  { label: 'BIO-REVEAL', icon: '✨', accent: T.orange },
];

/* ── Shared Components ── */

function GlowProgressBar({ step, total }: { step: number; total: number }) {
  const pct = ((step + 1) / total) * 100;
  const accent = STEP_META[step]?.accent || T.cyan;
  return (
    <div style={{ width: '100%', maxWidth: 440, margin: '0 auto', padding: '0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        {STEP_META.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: i <= step ? s.accent : 'rgba(255,255,255,0.08)',
              boxShadow: i <= step ? `0 0 8px ${s.accent}60` : 'none',
              transition: 'all 0.5s ease',
            }} />
            <span style={{
              fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.1em',
              color: i <= step ? s.accent + 'AA' : T.textTer,
              transition: 'color 0.5s',
              display: i === step ? 'inline' : 'none',
            }}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
      <div style={{
        height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)',
        overflow: 'hidden', position: 'relative',
      }}>
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          style={{
            height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${accent}60, ${accent})`,
            boxShadow: `0 0 12px ${accent}40, 0 0 30px ${accent}15`,
          }}
        />
      </div>
    </div>
  );
}

function ContinueBtn({ enabled, onClick, label, accent }: {
  enabled: boolean; onClick: () => void; label?: string; accent?: string;
}) {
  const c = accent || T.cyan;
  return (
    <motion.button
      whileTap={enabled ? { scale: 0.97 } : {}}
      onClick={enabled ? onClick : undefined}
      style={{
        width: '100%', padding: '14px 24px', borderRadius: 14, cursor: enabled ? 'pointer' : 'not-allowed',
        background: enabled ? `linear-gradient(135deg, ${c}20, ${c}08)` : 'rgba(255,255,255,0.02)',
        border: `1.5px solid ${enabled ? c + '50' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: enabled ? `0 0 30px ${c}15, inset 0 1px 0 rgba(255,255,255,0.04)` : 'none',
        color: enabled ? c : T.textTer,
        fontSize: 13, fontWeight: 600, letterSpacing: '0.02em',
        fontFamily: 'inherit', transition: 'all 0.3s ease',
      }}
    >
      {label || 'Continue'}
    </motion.button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        padding: '14px 18px', borderRadius: 14, cursor: 'pointer',
        background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}`,
        color: T.textSec, fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
      }}
    >
      ← Back
    </motion.button>
  );
}

function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle: string }) {
  const meta = STEP_META[step];
  return (
    <div style={{ textAlign: 'center' }}>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5, type: 'spring' }}
        style={{
          width: 60, height: 60, borderRadius: 18, margin: '0 auto 16px',
          background: `${meta.accent}10`, border: `1px solid ${meta.accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 50px ${meta.accent}12`,
          fontSize: 28,
        }}
      >
        {meta.icon}
      </motion.div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: meta.accent, boxShadow: `0 0 8px ${meta.accent}60` }} />
        <span style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: meta.accent + '70' }}>
          Step {step + 1} of 4
        </span>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: meta.accent, boxShadow: `0 0 8px ${meta.accent}60` }} />
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '-0.03em' }}>
        {title}
      </h1>
      <p style={{ fontSize: 12, color: T.textTer, marginTop: 8, lineHeight: 1.6, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
        {subtitle}
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 1 — Bio-Scanner
   ══════════════════════════════════════════════════════════════ */
interface BioData {
  age: number | null;
  weight: number | null;
  gender: 'male' | 'female' | 'other' | null;
  unit: 'lbs' | 'kg';
  goal: 'cognitive' | 'physical' | 'longevity' | null;
}

const GOALS = [
  { id: 'cognitive' as const, label: 'Cognitive Peak', icon: '🧠', desc: 'Optimize focus, memory, and mental clarity', accent: T.purple },
  { id: 'physical' as const, label: 'Physical Performance', icon: '⚡', desc: 'Maximize strength, endurance, and recovery', accent: T.cyan },
  { id: 'longevity' as const, label: 'Lifespan Extension', icon: '🧬', desc: 'Slow biological aging and extend healthspan', accent: T.green },
];

function BioScannerStep({ data, onChange, onContinue }: {
  data: BioData;
  onChange: (d: Partial<BioData>) => void;
  onContinue: () => void;
}) {
  const isValid = data.age && data.age > 0 && data.weight && data.weight > 0 && data.gender && data.goal;

  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      <StepHeader step={0} title="Bio-Scanner" subtitle="Initialize your biological profile. This data powers your Digital Twin and all AI-driven protocol recommendations." />

      {/* Age + Gender Row */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: T.textTer, marginBottom: 6, display: 'block' }}>
            Age
          </label>
          <input
            type="number"
            placeholder="34"
            value={data.age || ''}
            onChange={(e) => onChange({ age: e.target.value ? parseInt(e.target.value) : null })}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 16, fontWeight: 600,
              background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${data.age ? T.borderActive : T.border}`,
              color: T.text, fontFamily: 'inherit', outline: 'none',
              boxShadow: data.age ? `0 0 20px ${T.cyanGlow}` : 'none',
              transition: 'all 0.3s',
            }}
          />
        </div>
        <div style={{ flex: 1.5 }}>
          <label style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: T.textTer, marginBottom: 6, display: 'block' }}>
            Biological Sex
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['male', 'female', 'other'] as const).map((g) => (
              <motion.button
                key={g}
                whileTap={{ scale: 0.95 }}
                onClick={() => onChange({ gender: g })}
                style={{
                  flex: 1, padding: '12px 8px', borderRadius: 12, cursor: 'pointer',
                  background: data.gender === g ? T.cyanDim : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${data.gender === g ? T.borderActive : T.border}`,
                  color: data.gender === g ? T.cyan : T.textSec,
                  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                  textTransform: 'capitalize', transition: 'all 0.3s',
                }}
              >
                {g === 'male' ? '♂ Male' : g === 'female' ? '♀ Female' : '⚧ Other'}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* Weight */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: T.textTer }}>
            Weight
          </label>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['lbs', 'kg'] as const).map((u) => (
              <button
                key={u}
                onClick={() => onChange({ unit: u })}
                style={{
                  padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
                  background: data.unit === u ? T.cyanDim : 'transparent',
                  border: `1px solid ${data.unit === u ? T.borderActive : T.border}`,
                  color: data.unit === u ? T.cyan : T.textTer,
                  fontSize: 9, fontFamily: 'monospace', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
        <input
          type="number"
          placeholder={data.unit === 'lbs' ? '185' : '84'}
          value={data.weight || ''}
          onChange={(e) => onChange({ weight: e.target.value ? parseFloat(e.target.value) : null })}
          style={{
            width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 16, fontWeight: 600,
            background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${data.weight ? T.borderActive : T.border}`,
            color: T.text, fontFamily: 'inherit', outline: 'none',
            boxShadow: data.weight ? `0 0 20px ${T.cyanGlow}` : 'none',
            transition: 'all 0.3s',
          }}
        />
      </div>

      {/* Primary Goal */}
      <div>
        <label style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: T.textTer, marginBottom: 8, display: 'block' }}>
          Primary Goal
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {GOALS.map((g) => {
            const sel = data.goal === g.id;
            return (
              <motion.button
                key={g.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => onChange({ goal: g.id })}
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
                  background: sel ? `${g.accent}10` : 'rgba(255,255,255,0.02)',
                  border: `1.5px solid ${sel ? g.accent + '40' : T.border}`,
                  boxShadow: sel ? `0 0 30px ${g.accent}12` : 'none',
                  display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                  transition: 'all 0.3s',
                }}
              >
                <span style={{ fontSize: 24 }}>{g.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: sel ? g.accent : T.text, transition: 'color 0.3s' }}>{g.label}</div>
                  <div style={{ fontSize: 10, color: T.textSec, marginTop: 2 }}>{g.desc}</div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${sel ? g.accent : 'rgba(255,255,255,0.12)'}`,
                  background: sel ? g.accent : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.3s',
                }}>
                  {sel && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5 L4 7 L8 3" stroke={T.bg} strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <ContinueBtn enabled={!!isValid} onClick={onContinue} label="Initialize Bio-Profile →" />
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 2 — Lab Integration
   ══════════════════════════════════════════════════════════════ */
type LabSource = 'apple_health' | 'blood_work' | 'dna' | 'skip';

const LAB_OPTIONS: { id: LabSource; label: string; icon: string; desc: string; accent: string }[] = [
  { id: 'apple_health', label: 'Sync Apple Health', icon: '❤️', desc: 'Import HRV, sleep, activity, and heart rate data automatically', accent: '#FF375F' },
  { id: 'blood_work', label: 'Upload Blood Work', icon: '🩸', desc: 'Upload PDF or enter lab values (CBC, metabolic panel, hormones)', accent: T.orange },
  { id: 'dna', label: 'Upload DNA Results', icon: '🧬', desc: 'Import 23andMe, AncestryDNA, or raw genetic data for MTHFR/APOE4', accent: T.purple },
  { id: 'skip', label: 'Skip for Now', icon: '⏭️', desc: 'Start with manual tracking — you can add lab data anytime', accent: T.textTer },
];

function LabIntegrationStep({ selected, onSelect, onContinue, onBack }: {
  selected: LabSource[];
  onSelect: (s: LabSource) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [syncing, setSyncing] = useState<string | null>(null);

  const handleSelect = (id: LabSource) => {
    if (id === 'skip') {
      onSelect('skip');
      return;
    }
    // Simulate sync animation
    setSyncing(id);
    setTimeout(() => {
      setSyncing(null);
      onSelect(id);
    }, 1200);
  };

  const hasSelection = selected.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      <StepHeader step={1} title="Lab Integration" subtitle="Connect your biological data sources. More data means more precise AI recommendations and a sharper Digital Twin." />

      {/* Data completeness indicator */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12,
          background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}`,
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: hasSelection ? T.green : T.orange, boxShadow: `0 0 8px ${hasSelection ? T.green : T.orange}40`, animation: 'pulse 2s ease-in-out infinite' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: T.textSec, letterSpacing: '0.06em' }}>
            DATA COMPLETENESS
          </div>
          <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)', marginTop: 4, overflow: 'hidden' }}>
            <motion.div
              animate={{ width: `${selected.includes('skip') ? 15 : Math.min(15 + selected.length * 28, 100)}%` }}
              transition={{ duration: 0.6 }}
              style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${T.green}60, ${T.green})` }}
            />
          </div>
        </div>
        <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: hasSelection ? T.green : T.orange }}>
          {selected.includes('skip') ? '15%' : `${Math.min(15 + selected.filter(s => s !== 'skip').length * 28, 100)}%`}
        </span>
      </motion.div>

      {/* Lab source cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {LAB_OPTIONS.map((opt, idx) => {
          const isSel = selected.includes(opt.id);
          const isSyncing = syncing === opt.id;
          const isSkip = opt.id === 'skip';
          const disabled = isSkip ? selected.some(s => s !== 'skip') : selected.includes('skip');

          return (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + idx * 0.08 }}
              whileTap={!disabled ? { scale: 0.98 } : {}}
              onClick={() => !disabled && !isSyncing && handleSelect(opt.id)}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 14, cursor: disabled ? 'not-allowed' : 'pointer',
                background: isSel ? `${opt.accent}10` : 'rgba(255,255,255,0.02)',
                border: `1.5px solid ${isSel ? opt.accent + '40' : T.border}`,
                boxShadow: isSel ? `0 0 25px ${opt.accent}12` : 'none',
                display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                opacity: disabled ? 0.35 : 1, transition: 'all 0.3s',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: isSel ? `${opt.accent}15` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isSel ? opt.accent + '30' : 'rgba(255,255,255,0.06)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                position: 'relative', overflow: 'hidden',
              }}>
                {isSyncing ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 20, height: 20, border: `2px solid ${opt.accent}30`, borderTopColor: opt.accent, borderRadius: '50%' }}
                  />
                ) : opt.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: isSel ? opt.accent : T.text, transition: 'color 0.3s' }}>
                  {isSyncing ? 'Syncing...' : opt.label}
                </div>
                <div style={{ fontSize: 10, color: T.textSec, marginTop: 2, lineHeight: 1.4 }}>{opt.desc}</div>
              </div>
              {isSel && !isSkip && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{
                  width: 22, height: 22, borderRadius: '50%', background: opt.accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6 L5 8.5 L9.5 3.5" stroke={T.bg} strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <BackBtn onClick={onBack} />
        <div style={{ flex: 1 }}>
          <ContinueBtn enabled={hasSelection} onClick={onContinue} label="Continue →" accent={T.green} />
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 3 — Protocol Selection
   ══════════════════════════════════════════════════════════════ */
type ProtocolPath = 'peptides' | 'trt' | 'holistic';

const PROTOCOL_PATHS: { id: ProtocolPath; label: string; icon: string; desc: string; accent: string; examples: string[]; safetyLevel: string; safetyColor: string }[] = [
  {
    id: 'peptides', label: 'Peptide Protocols', icon: '💉',
    desc: 'BPC-157, TB-500, Ipamorelin, CJC-1295 — targeted tissue repair and growth hormone optimization.',
    accent: T.purple, examples: ['BPC-157 250mcg SC', 'TB-500 2.5mg/wk', 'Ipamorelin 200mcg'],
    safetyLevel: 'ADVANCED', safetyColor: T.orange,
  },
  {
    id: 'trt', label: 'TRT / Hormone Optimization', icon: '⚗️',
    desc: 'Testosterone replacement, estrogen management, thyroid optimization — physician-supervised protocols.',
    accent: T.cyan, examples: ['Testosterone Cypionate', 'Anastrozole', 'DHEA 25mg'],
    safetyLevel: 'PHYSICIAN REQUIRED', safetyColor: T.red,
  },
  {
    id: 'holistic', label: 'Holistic Only', icon: '🌿',
    desc: 'Supplements, nutrition, sleep, cold exposure, breathwork — evidence-based natural optimization.',
    accent: T.green, examples: ['Omega-3 2g', 'Magnesium 400mg', 'Cold Exposure 2min'],
    safetyLevel: 'SAFE', safetyColor: T.green,
  },
];

function ProtocolSelectionStep({ selected, onSelect, onContinue, onBack }: {
  selected: ProtocolPath[];
  onSelect: (p: ProtocolPath) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 20 }}
    >
      <StepHeader step={2} title="Protocol Selection" subtitle="Select the protocol categories you use or plan to use. This customizes your tracking, AI recommendations, and safety monitoring." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {PROTOCOL_PATHS.map((path, idx) => {
          const isSel = selected.includes(path.id);
          return (
            <motion.button
              key={path.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + idx * 0.1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(path.id)}
              style={{
                width: '100%', padding: '16px', borderRadius: 16, cursor: 'pointer',
                background: isSel ? `${path.accent}08` : 'rgba(255,255,255,0.015)',
                border: `1.5px solid ${isSel ? path.accent + '40' : T.border}`,
                boxShadow: isSel ? `0 0 30px ${path.accent}10` : 'none',
                textAlign: 'left', transition: 'all 0.3s',
              }}
            >
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                  background: isSel ? `${path.accent}15` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSel ? path.accent + '25' : 'rgba(255,255,255,0.06)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                }}>
                  {path.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: isSel ? path.accent : T.text }}>{path.label}</span>
                    <span style={{
                      fontSize: 7, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.1em',
                      padding: '2px 6px', borderRadius: 4,
                      background: `${path.safetyColor}12`, color: path.safetyColor,
                      border: `1px solid ${path.safetyColor}25`,
                    }}>
                      {path.safetyLevel}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: T.textSec, lineHeight: 1.5, margin: '0 0 10px 0' }}>{path.desc}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {path.examples.map((ex) => (
                      <span key={ex} style={{
                        fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.06em',
                        padding: '3px 8px', borderRadius: 5,
                        background: isSel ? `${path.accent}10` : 'rgba(255,255,255,0.03)',
                        color: isSel ? `${path.accent}BB` : T.textTer,
                      }}>
                        {ex}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 2,
                  border: `2px solid ${isSel ? path.accent : 'rgba(255,255,255,0.12)'}`,
                  background: isSel ? path.accent : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.3s',
                }}>
                  {isSel && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2.5 6 L5 8.5 L9.5 3.5" stroke={T.bg} strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <BackBtn onClick={onBack} />
        <div style={{ flex: 1 }}>
          <ContinueBtn enabled={selected.length > 0} onClick={onContinue} label="Generate Vitality Score →" accent={T.purple} />
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP 4 — Bio-Reveal (Vitality Score + Biological Age)
   ══════════════════════════════════════════════════════════════ */

function AnimatedScore({ target, duration }: { target: number; duration: number }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => requestAnimationFrame(tick), 400);
    return () => clearTimeout(timer);
  }, [target, duration]);
  return <>{current}</>;
}

function VitalityRing({ score, size, accent }: { score: number; size: number; accent: string }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(circumference - (score / 100) * circumference);
    }, 600);
    return () => clearTimeout(timer);
  }, [score, circumference]);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {/* Glow backdrop */}
      <div style={{
        position: 'absolute', inset: -20,
        background: `radial-gradient(circle, ${accent}15 0%, transparent 70%)`,
        borderRadius: '50%', filter: 'blur(20px)',
      }} />
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'relative', zIndex: 1 }}>
        {/* Track */}
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={8} />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={accent} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 2s cubic-bezier(0.4, 0, 0.2, 1)', filter: `drop-shadow(0 0 8px ${accent}60)` }}
        />
      </svg>
      {/* Center content */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', zIndex: 2,
      }}>
        <div style={{ fontSize: 42, fontWeight: 800, color: accent, letterSpacing: '-0.04em', lineHeight: 1 }}>
          <AnimatedScore target={score} duration={2} />
        </div>
        <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.15em', marginTop: 4 }}>
          VITALITY SCORE
        </div>
      </div>
    </div>
  );
}

function BioRevealStep({ bioData, labSources, protocols, onComplete }: {
  bioData: BioData;
  labSources: LabSource[];
  protocols: ProtocolPath[];
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<'scanning' | 'reveal'>('scanning');
  const [scanLine, setScanLine] = useState(0);

  // Compute vitality score from inputs
  const vitalityScore = (() => {
    let base = 55;
    // Age factor
    const age = bioData.age || 35;
    if (age < 30) base += 8;
    else if (age < 40) base += 5;
    else if (age < 50) base += 2;
    else base -= 2;
    // Lab data bonus
    const realLabs = labSources.filter(s => s !== 'skip');
    base += realLabs.length * 5;
    // Protocol sophistication
    if (protocols.includes('peptides')) base += 4;
    if (protocols.includes('trt')) base += 3;
    if (protocols.includes('holistic')) base += 2;
    // Weight in healthy range bonus
    const w = bioData.weight || 180;
    const isKg = bioData.unit === 'kg';
    const wKg = isKg ? w : w * 0.453592;
    if (wKg > 60 && wKg < 100) base += 3;
    return Math.min(Math.max(Math.round(base), 35), 92);
  })();

  const biologicalAge = (() => {
    const age = bioData.age || 35;
    const delta = vitalityScore > 70 ? -(vitalityScore - 70) * 0.15 : (70 - vitalityScore) * 0.12;
    return Math.round(age + delta);
  })();

  const ageDelta = (bioData.age || 35) - biologicalAge;

  const scoreColor = vitalityScore >= 75 ? T.green : vitalityScore >= 55 ? T.cyan : T.orange;

  // Scanning animation
  useEffect(() => {
    const scanSteps = [
      'Initializing Bio-Scanner...',
      'Analyzing metabolic baseline...',
      'Mapping cardiovascular markers...',
      'Calculating endocrine profile...',
      'Running longevity algorithms...',
      'Computing Vitality Score...',
    ];
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setScanLine(i);
      if (i >= scanSteps.length) {
        clearInterval(interval);
        setTimeout(() => setPhase('reveal'), 600);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const scanSteps = [
    'Initializing Bio-Scanner...',
    'Analyzing metabolic baseline...',
    'Mapping cardiovascular markers...',
    'Calculating endocrine profile...',
    'Running longevity algorithms...',
    'Computing Vitality Score...',
  ];

  if (phase === 'scanning') {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{
          width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 24, minHeight: 400,
        }}
      >
        {/* Scanning ring */}
        <div style={{ position: 'relative', width: 120, height: 120 }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            style={{
              width: 120, height: 120, borderRadius: '50%',
              border: `2px solid rgba(0,240,255,0.08)`, borderTopColor: T.cyan,
              boxShadow: `0 0 30px ${T.cyanGlow}`,
            }}
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute', inset: 16,
              borderRadius: '50%',
              border: `2px solid rgba(0,255,204,0.06)`, borderBottomColor: T.green,
            }}
          />
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36,
          }}>
            🧬
          </div>
        </div>

        {/* Scan lines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 280 }}>
          {scanSteps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: i < scanLine ? 1 : 0.15, x: 0 }}
              transition={{ duration: 0.3 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i < scanLine ? T.green : 'rgba(255,255,255,0.08)',
                boxShadow: i < scanLine ? `0 0 6px ${T.green}60` : 'none',
                transition: 'all 0.3s',
              }} />
              <span style={{
                fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.06em',
                color: i < scanLine ? T.textSec : T.textTer,
                transition: 'color 0.3s',
              }}>
                {step}
              </span>
              {i === scanLine - 1 && (
                <motion.span
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ fontSize: 9, color: T.green, fontFamily: 'monospace' }}
                >
                  ✓
                </motion.span>
              )}
            </motion.div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%', maxWidth: 280, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${(scanLine / scanSteps.length) * 100}%` }}
            transition={{ duration: 0.4 }}
            style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${T.cyan}60, ${T.green})`, boxShadow: `0 0 10px ${T.cyan}30` }}
          />
        </div>
      </motion.div>
    );
  }

  // Reveal phase
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      style={{
        width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 24,
      }}
    >
      <StepHeader step={3} title="Your Bio-Reveal" subtitle="Your Digital Twin has been initialized. Here is your starting biological assessment." />

      {/* Vitality Ring */}
      <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, duration: 0.8, type: 'spring' }}>
        <VitalityRing score={vitalityScore} size={180} accent={scoreColor} />
      </motion.div>

      {/* Biological Age Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}
        style={{
          width: '100%', padding: '16px 20px', borderRadius: 16,
          background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', gap: 16,
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: ageDelta > 0 ? T.greenDim : T.orangeDim,
          border: `1px solid ${ageDelta > 0 ? T.green + '30' : T.orange + '30'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 800, color: ageDelta > 0 ? T.green : T.orange,
          fontFamily: 'monospace',
        }}>
          {biologicalAge}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Biological Age</div>
          <div style={{ fontSize: 11, color: T.textSec, marginTop: 2 }}>
            Chronological: {bioData.age} · Delta: <span style={{ color: ageDelta > 0 ? T.green : T.orange, fontWeight: 600 }}>
              {ageDelta > 0 ? `-${ageDelta}` : `+${Math.abs(ageDelta)}`} years
            </span>
          </div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 8,
          background: ageDelta > 0 ? T.greenDim : T.orangeDim,
          border: `1px solid ${ageDelta > 0 ? T.green + '25' : T.orange + '25'}`,
        }}>
          <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700, color: ageDelta > 0 ? T.green : T.orange }}>
            {ageDelta > 0 ? 'YOUNGER' : 'OLDER'}
          </span>
        </div>
      </motion.div>

      {/* System breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}
        style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        <div style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.15em', color: T.textTer, marginBottom: 4 }}>
          System Baseline Estimates
        </div>
        {[
          { label: 'Cardiovascular', score: Math.min(vitalityScore + 5, 95), color: '#FF375F' },
          { label: 'Metabolic', score: Math.min(vitalityScore - 2, 90), color: T.orange },
          { label: 'Nervous System', score: Math.min(vitalityScore + 3, 92), color: T.purple },
          { label: 'Endocrine', score: Math.min(vitalityScore - 5, 85), color: T.cyan },
          { label: 'Immune', score: Math.min(vitalityScore + 1, 88), color: T.green },
        ].map((sys, i) => (
          <motion.div
            key={sys.label}
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.4 + i * 0.1 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <span style={{ fontSize: 10, color: T.textSec, width: 100, flexShrink: 0 }}>{sys.label}</span>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${sys.score}%` }}
                transition={{ delay: 1.6 + i * 0.1, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${sys.color}60, ${sys.color})`, boxShadow: `0 0 6px ${sys.color}25` }}
              />
            </div>
            <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: sys.color, minWidth: 28, textAlign: 'right' }}>
              {sys.score}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* AI insight */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.2 }}
        style={{
          width: '100%', padding: '14px 16px', borderRadius: 14,
          background: `${scoreColor}06`, border: `1px solid ${scoreColor}20`,
          borderLeft: `3px solid ${scoreColor}50`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: scoreColor, boxShadow: `0 0 6px ${scoreColor}60`, animation: 'pulse 2s ease-in-out infinite' }} />
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: scoreColor, letterSpacing: '0.1em' }}>AI BRAIN ASSESSMENT</span>
        </div>
        <p style={{ fontSize: 11, color: T.textSec, lineHeight: 1.6, margin: 0 }}>
          {vitalityScore >= 75
            ? `Strong biological foundation at ${vitalityScore}/100. Your systems are well-calibrated. Focus on consistency with your ${protocols.includes('peptides') ? 'peptide' : protocols.includes('trt') ? 'hormone' : 'holistic'} protocols to push toward elite-tier optimization.`
            : vitalityScore >= 55
              ? `Solid baseline at ${vitalityScore}/100 with clear optimization vectors. Your ${protocols.includes('peptides') ? 'peptide protocols' : protocols.includes('trt') ? 'hormone optimization' : 'holistic approach'} combined with targeted nutrition will drive measurable improvements within 30 days.`
              : `Starting score of ${vitalityScore}/100 reveals significant optimization potential. This is actually ideal — you will see the most dramatic improvements in the first 90 days as your protocols take effect.`
          }
        </p>
      </motion.div>

      {/* Launch button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.6 }}
        style={{ width: '100%' }}
      >
        <ContinueBtn enabled onClick={onComplete} label="Launch Your Longevity OS →" accent={scoreColor} />
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN ONBOARDING SCANNER COMPONENT
   ══════════════════════════════════════════════════════════════ */

export default function OnboardingScanner({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [bioData, setBioData] = useState<BioData>({ age: null, weight: null, gender: null, unit: 'lbs', goal: null });
  const [labSources, setLabSources] = useState<LabSource[]>([]);
  const [protocols, setProtocols] = useState<ProtocolPath[]>([]);

  const upsertVitals = useMutation(api.mutations.upsertUserVitals);
  const upsertPrefs = useMutation(api.mutations.upsertUserPreference);

  const handleBioChange = useCallback((partial: Partial<BioData>) => {
    setBioData(prev => ({ ...prev, ...partial }));
  }, []);

  const handleLabToggle = useCallback((source: LabSource) => {
    setLabSources(prev => {
      if (source === 'skip') return ['skip'];
      const filtered = prev.filter(s => s !== 'skip');
      return filtered.includes(source) ? filtered.filter(s => s !== source) : [...filtered, source];
    });
  }, []);

  const handleProtocolToggle = useCallback((p: ProtocolPath) => {
    setProtocols(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }, []);

  const handleComplete = useCallback(async () => {
    try {
      const sessionId = getTwinSessionId();
      // Save vitals
      if (bioData.age && bioData.weight && bioData.gender) {
        await upsertVitals({
          sessionId,
          age: bioData.age,
          gender: bioData.gender,
          weight: bioData.weight,
          unit: bioData.unit,
        });
      }
      // Save protocol preference
      const missionProfile = protocols.join(',');
      await upsertPrefs({
        sessionId,
        userStyle: protocols.includes('peptides') || protocols.includes('trt') ? 'elite' : 'core',
        missionProfile,
      });
      // Mark onboarding complete
      localStorage.setItem('vive-onboarding-complete', 'true');
      localStorage.setItem('vive-onboarding-date', new Date().toISOString());
    } catch (err) {
      console.error('[OnboardingScanner] Save error:', err);
    }
    onComplete();
  }, [bioData, protocols, upsertVitals, upsertPrefs, onComplete]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: T.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', overflow: 'auto',
    }}>
      {/* Ambient background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: `radial-gradient(ellipse at 50% 30%, ${STEP_META[step].accent}06 0%, transparent 60%)`,
        transition: 'background 0.8s ease',
      }} />

      {/* Header */}
      <div style={{ padding: '24px 20px 0', width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          <span style={{ fontSize: 18 }}>⬡</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>VIVE 4.0</span>
          <span style={{ fontSize: 8, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.1em', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}` }}>
            ONBOARDING
          </span>
        </div>
        <GlowProgressBar step={step} total={4} />
      </div>

      {/* Step content */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '32px 20px 40px', width: '100%', position: 'relative', zIndex: 1,
      }}>
        <AnimatePresence mode="wait">
          {step === 0 && (
            <BioScannerStep
              key="bio"
              data={bioData}
              onChange={handleBioChange}
              onContinue={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <LabIntegrationStep
              key="lab"
              selected={labSources}
              onSelect={handleLabToggle}
              onContinue={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <ProtocolSelectionStep
              key="protocol"
              selected={protocols}
              onSelect={handleProtocolToggle}
              onContinue={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <BioRevealStep
              key="reveal"
              bioData={bioData}
              labSources={labSources}
              protocols={protocols}
              onComplete={handleComplete}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
