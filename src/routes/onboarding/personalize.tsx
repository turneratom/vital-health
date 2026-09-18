import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  setGlobalUserStyle,
  setGlobalMissionProfile,
  setOnboardingComplete,
  type UserStyle,
  type MissionProfile,
  getMacroProfile,
} from '@/lib/useUserStyle';
import { SyncLabScreen } from '@/components/SyncLabScreen';
import {
  computeAllBaselines,
  serializeBaselines,
  type BiologicalSex,
} from '@/lib/intelligence/BioLogic';
import {
  calculateMetabolicScoreFromVitals,
  getScoreRingProps,
  type MetabolicScoreResult,
} from '@/utils/BioCalculations';

import { getTwinSessionId } from '@/lib/twinSession'
/* ═══════════════════════════════════════════════════════════
   STEP 1 — Collect Vitals (Age, Gender, Weight, Goal Weight)
   ═══════════════════════════════════════════════════════════ */

type Gender = 'male' | 'female' | 'other' | 'prefer_not';

interface VitalsData {
  age: string;
  gender: Gender | null;
  weight: string;
  goalWeight: string;
  unit: 'lbs' | 'kg';
}

function VitalsHelixIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="20" stroke="rgba(0,240,255,0.12)" strokeWidth="1" strokeDasharray="3 4" />
      <path d="M10 24 H16 L18 18 L21 30 L24 20 L27 28 L29 24 H38" stroke="#00F0FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle cx="24" cy="24" r="2.5" fill="#00F0FF" opacity="0.3" />
      <circle cx="24" cy="24" r="1.5" fill="#00F0FF" opacity="0.6" />
      <circle cx="24" cy="24" r="8" fill="#00F0FF" opacity="0.04" filter="url(#vitalsGlow)" />
      <defs>
        <filter id="vitalsGlow" x="8" y="8" width="32" height="32" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
    </svg>
  );
}

const genderOptions: { id: Gender; label: string; icon: string }[] = [
  { id: 'male', label: 'Male', icon: '\u2642' },
  { id: 'female', label: 'Female', icon: '\u2640' },
  { id: 'other', label: 'Other', icon: '\u26A5' },
  { id: 'prefer_not', label: 'Skip', icon: '\u2014' },
];

function VitalsStep({ onContinue }: { onContinue: (data: VitalsData) => void }) {
  const [mounted, setMounted] = useState(false);
  const [vitals, setVitals] = useState<VitalsData>({
    age: '',
    gender: null,
    weight: '',
    goalWeight: '',
    unit: 'lbs',
  });

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const canContinue = vitals.age.trim() !== '' && vitals.weight.trim() !== '';

  const inputStyle = (hasValue: boolean): React.CSSProperties => ({
    background: hasValue ? 'rgba(0,240,255,0.04)' : 'rgba(255,255,255,0.02)',
    border: `1px solid ${hasValue ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
    color: 'rgba(255,255,255,0.9)',
    outline: 'none',
    transition: 'all 0.3s ease',
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: mounted ? 1 : 0, x: mounted ? 0 : 40 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="w-full max-w-md flex flex-col items-center gap-6 relative z-10"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.1 }}>
          <VitalsHelixIcon />
        </motion.div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00F0FF', boxShadow: '0 0 6px rgba(0,240,255,0.5)' }} />
          <span className="text-[9px] font-mono uppercase tracking-[0.2em]" style={{ color: 'rgba(0,240,255,0.5)' }}>Getting Started</span>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00F0FF', boxShadow: '0 0 6px rgba(0,240,255,0.5)' }} />
        </div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'rgba(255,255,255,0.92)' }}>Your Vitals</h1>
        <p className="text-[12px] leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          A few quick details so we can personalize your daily plan and help you feel your best.
        </p>
      </div>

      {/* Age */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 12 }} transition={{ duration: 0.5, delay: 0.15 }} className="w-full">
        <label className="block mb-1.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.35)' }}>Age</span>
        </label>
        <input type="number" inputMode="numeric" placeholder="28" value={vitals.age} onChange={(e) => setVitals(prev => ({ ...prev, age: e.target.value }))} className="w-full px-4 py-3 rounded-xl text-[15px] font-mono placeholder:text-white/15" style={inputStyle(vitals.age !== '')} min={13} max={120} />
      </motion.div>

      {/* Gender */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 12 }} transition={{ duration: 0.5, delay: 0.2 }} className="w-full">
        <label className="block mb-1.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.35)' }}>Gender</span>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {genderOptions.map((opt) => {
            const isSelected = vitals.gender === opt.id;
            return (
              <button key={opt.id} onClick={() => setVitals(prev => ({ ...prev, gender: opt.id }))} className="flex flex-col items-center gap-1 py-3 rounded-xl transition-all duration-300" style={{ background: isSelected ? 'rgba(0,240,255,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isSelected ? 'rgba(0,240,255,0.3)' : 'rgba(255,255,255,0.06)'}`, boxShadow: isSelected ? '0 0 15px rgba(0,240,255,0.08)' : 'none' }}>
                <span className="text-base" style={{ opacity: isSelected ? 1 : 0.4 }}>{opt.icon}</span>
                <span className="text-[10px] font-medium tracking-wide" style={{ color: isSelected ? '#00F0FF' : 'rgba(255,255,255,0.35)' }}>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Weight */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 12 }} transition={{ duration: 0.5, delay: 0.25 }} className="w-full">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.35)' }}>Weight</span>
          <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {(['lbs', 'kg'] as const).map((u) => (
              <button key={u} onClick={() => setVitals(prev => ({ ...prev, unit: u }))} className="px-2.5 py-1 rounded-md text-[9px] font-mono uppercase tracking-wider transition-all duration-200" style={{ background: vitals.unit === u ? 'rgba(0,240,255,0.1)' : 'transparent', color: vitals.unit === u ? '#00F0FF' : 'rgba(255,255,255,0.3)', border: vitals.unit === u ? '1px solid rgba(0,240,255,0.2)' : '1px solid transparent' }}>
                {u}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[9px] font-mono uppercase tracking-wider block mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>Current</span>
            <input type="number" inputMode="decimal" placeholder={vitals.unit === 'lbs' ? '175' : '79'} value={vitals.weight} onChange={(e) => setVitals(prev => ({ ...prev, weight: e.target.value }))} className="w-full px-4 py-3 rounded-xl text-[15px] font-mono placeholder:text-white/15" style={inputStyle(vitals.weight !== '')} />
          </div>
          <div>
            <span className="text-[9px] font-mono uppercase tracking-wider block mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>Goal</span>
            <input type="number" inputMode="decimal" placeholder={vitals.unit === 'lbs' ? '165' : '75'} value={vitals.goalWeight} onChange={(e) => setVitals(prev => ({ ...prev, goalWeight: e.target.value }))} className="w-full px-4 py-3 rounded-xl text-[15px] font-mono placeholder:text-white/15" style={inputStyle(vitals.goalWeight !== '')} />
          </div>
        </div>
      </motion.div>

      {/* Continue */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: mounted ? 1 : 0 }} transition={{ duration: 0.5, delay: 0.35 }} className="w-full pt-2">
        <button onClick={() => canContinue && onContinue(vitals)} disabled={!canContinue} className="w-full py-3.5 rounded-xl text-[13px] font-semibold tracking-wide uppercase transition-all duration-300" style={{ background: canContinue ? 'rgba(0,240,255,0.12)' : 'rgba(255,255,255,0.03)', border: `1.5px solid ${canContinue ? 'rgba(0,240,255,0.3)' : 'rgba(255,255,255,0.06)'}`, color: canContinue ? '#00F0FF' : 'rgba(255,255,255,0.2)', boxShadow: canContinue ? '0 0 20px rgba(0,240,255,0.1)' : 'none', cursor: canContinue ? 'pointer' : 'not-allowed' }}>
          Save & Continue
        </button>
      </motion.div>
    </motion.div>
  );
}


/* ═══════════════════════════════════════════════════════════
   STEP 3 — Mission Profile Selection (Core / Elite / Hard Truth)
   ═══════════════════════════════════════════════════════════ */

/* ── SVG Icons for each mission profile ── */

function CoreMissionIcon({ selected }: { selected: boolean }) {
  const c = selected ? '#00FFCC' : 'rgba(255,255,255,0.25)';
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      {/* Shield outline */}
      <path d="M22 4 L38 10 L38 22 C38 32 30 38 22 42 C14 38 6 32 6 22 L6 10 Z" stroke={c} strokeWidth="1.2" fill="none" opacity={selected ? 0.9 : 0.4} />
      {/* Inner leaf / energy symbol */}
      <path d="M22 14 C18 18 16 22 18 26 C20 24 22 20 22 20 C22 20 24 24 26 26 C28 22 26 18 22 14Z" fill={c} opacity={selected ? 0.6 : 0.2} />
      {/* Pulse line */}
      <path d="M12 22 H17 L19 18 L22 26 L25 20 L27 22 H32" stroke={c} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity={selected ? 0.7 : 0.25} />
      {selected && <circle cx="22" cy="22" r="14" fill="#00FFCC" opacity="0.06" />}
    </svg>
  );
}

function EliteMissionIcon({ selected }: { selected: boolean }) {
  const c = selected ? '#00F0FF' : 'rgba(255,255,255,0.25)';
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      {/* DNA helix */}
      <path d="M15 6 C15 14, 29 14, 29 22 C29 30, 15 30, 15 38" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity={selected ? 0.9 : 0.4} />
      <path d="M29 6 C29 14, 15 14, 15 22 C15 30, 29 30, 29 38" stroke={c} strokeWidth="1.2" strokeLinecap="round" opacity={selected ? 0.9 : 0.4} />
      {/* Rungs */}
      {[10, 16, 22, 28, 34].map((y, i) => (
        <line key={i} x1={17 + (i % 2 === 0 ? 0 : 2)} y1={y} x2={27 - (i % 2 === 0 ? 0 : 2)} y2={y} stroke={c} strokeWidth="0.8" opacity={selected ? 0.5 : 0.15} />
      ))}
      {/* Nodes */}
      {selected && [14, 22, 30].map((y, i) => (
        <circle key={i} cx="22" cy={y} r="1.5" fill="#00F0FF" opacity={0.8 - i * 0.15} />
      ))}
      {selected && <rect x="12" y="4" width="20" height="36" rx="10" fill="#00F0FF" opacity="0.04" />}
    </svg>
  );
}

function HardTruthIcon({ selected }: { selected: boolean }) {
  const c = selected ? '#FF4444' : 'rgba(255,255,255,0.25)';
  const c2 = selected ? '#FF6B00' : 'rgba(255,255,255,0.2)';
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
      {/* Crosshair outer */}
      <circle cx="22" cy="22" r="16" stroke={c} strokeWidth="1" strokeDasharray="3 2" opacity={selected ? 0.6 : 0.25} />
      <circle cx="22" cy="22" r="10" stroke={c} strokeWidth="1.2" fill="none" opacity={selected ? 0.8 : 0.3} />
      {/* Crosshair lines */}
      <line x1="22" y1="4" x2="22" y2="14" stroke={c} strokeWidth="1" opacity={selected ? 0.7 : 0.2} />
      <line x1="22" y1="30" x2="22" y2="40" stroke={c} strokeWidth="1" opacity={selected ? 0.7 : 0.2} />
      <line x1="4" y1="22" x2="14" y2="22" stroke={c} strokeWidth="1" opacity={selected ? 0.7 : 0.2} />
      <line x1="30" y1="22" x2="40" y2="22" stroke={c} strokeWidth="1" opacity={selected ? 0.7 : 0.2} />
      {/* Center target */}
      <circle cx="22" cy="22" r="3" fill={c} opacity={selected ? 0.9 : 0.3} />
      {/* Lightning bolt */}
      <path d="M20 16 L18 22 L21 22 L19 28 L26 20 L23 20 L25 16 Z" fill={c2} opacity={selected ? 0.8 : 0.2} />
      {selected && <circle cx="22" cy="22" r="12" fill="#FF4444" opacity="0.06" />}
    </svg>
  );
}

/* ── Macro Preview Bar ── */
function MacroPreviewBar({ profile, visible }: { profile: MissionProfile; visible: boolean }) {
  const macros = getMacroProfile(profile);
  const total = macros.protein + macros.carbs + macros.fat;
  const pPct = Math.round((macros.protein / total) * 100);
  const cPct = Math.round((macros.carbs / total) * 100);
  const fPct = 100 - pPct - cPct;

  const colors: Record<MissionProfile, { p: string; c: string; f: string }> = {
    core: { p: '#00FFCC', c: '#4ECDC4', f: '#45B7D1' },
    elite: { p: '#00F0FF', c: '#7B68EE', f: '#BF5AF2' },
    'hard-truth': { p: '#FF4444', c: '#FF8C00', f: '#FFD700' },
  };

  const col = colors[profile];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: visible ? 1 : 0, height: visible ? 'auto' : 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div className="pt-3 mt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Daily Macro Target
          </span>
          <span className="text-[10px] font-semibold tabular-nums" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {macros.calories} kcal
          </span>
        </div>

        {/* Stacked bar */}
        <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: visible ? `${pPct}%` : 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="h-full rounded-l-full"
            style={{ background: col.p }}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: visible ? `${cPct}%` : 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="h-full"
            style={{ background: col.c }}
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: visible ? `${fPct}%` : 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="h-full rounded-r-full"
            style={{ background: col.f }}
          />
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-2">
          {[
            { label: 'Protein', val: macros.protein, color: col.p },
            { label: 'Carbs', val: macros.carbs, color: col.c },
            { label: 'Fat', val: macros.fat, color: col.f },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: m.color, opacity: 0.8 }} />
              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {m.label}
              </span>
              <span className="text-[9px] font-semibold tabular-nums" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {m.val}g
              </span>
            </div>
          ))}
        </div>

        {/* Strategy label */}
        <div className="mt-2 px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
          <span className="text-[9px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {macros.mealStyle}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Mission Profile Card ── */
interface ProfileOption {
  id: MissionProfile;
  codename: string;
  title: string;
  subtitle: string;
  description: string;
  clearance: string;
  accent: string;
  accentRgb: string;
  icon: (sel: boolean) => React.ReactNode;
  tags: string[];
}

const PROFILES: ProfileOption[] = [
  {
    id: 'core',
    codename: 'SIGMA-01',
    title: 'Core',
    subtitle: 'Feel Great Every Day',
    description: 'Balanced nutrition, gentle movement, and steady recovery. Perfect if you want more energy, less inflammation, and a plan you can stick with long-term.',
    clearance: 'Standard',
    accent: '#00FFCC',
    accentRgb: '0,255,204',
    icon: (sel) => <CoreMissionIcon selected={sel} />,
    tags: ['More Energy', 'Less Stress', 'Long-Term Health'],
  },
  {
    id: 'elite',
    codename: 'APEX-02',
    title: 'Elite',
    subtitle: 'Build Strength & Endurance',
    description: 'More fuel, bigger lifts, and better cardio. Designed for those who want to push harder, build muscle, and see measurable progress every week.',
    clearance: 'Elevated',
    accent: '#00F0FF',
    accentRgb: '0,240,255',
    icon: (sel) => <EliteMissionIcon selected={sel} />,
    tags: ['Build Muscle', 'Get Stronger', 'Peak Fitness'],
  },
  {
    id: 'hard-truth',
    codename: 'OMEGA-03',
    title: 'The Hard Truth',
    subtitle: 'Fast, Visible Results',
    description: 'The most aggressive path. Strict nutrition, intense workouts, and zero shortcuts. For those who want dramatic body changes and are ready to commit fully.',
    clearance: 'Restricted',
    accent: '#FF4444',
    accentRgb: '255,68,68',
    icon: (sel) => <HardTruthIcon selected={sel} />,
    tags: ['Burn Fat', 'Get Lean', 'Total Commitment'],
  },
];

function MissionProfileStep({ onContinue, onBack }: { onContinue: (profile: MissionProfile) => void; onBack: () => void }) {
  const [selected, setSelected] = useState<MissionProfile | null>(null);
  const [mounted, setMounted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleConfirm = () => {
    if (!selected) return;
    setConfirmed(true);
    setTimeout(() => onContinue(selected), 500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: mounted ? 1 : 0, x: mounted ? 0 : 40 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="w-full max-w-md flex flex-col items-center gap-6 relative z-10"
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 0 30px rgba(0,240,255,0.05)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 2 L19 6 V12 C19 17 15 20 11 22 C7 20 3 17 3 12 V6 Z" stroke="rgba(0,240,255,0.5)" strokeWidth="1.2" fill="none" />
            <path d="M8 11 L10 13 L14 9" stroke="rgba(0,240,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>

        <div className="flex items-center gap-2 mb-1">
          <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(0,240,255,0.5)' }} />
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'rgba(0,240,255,0.45)' }}>
            Choose Your Path
          </span>
          <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(0,240,255,0.5)' }} />
        </div>

        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'rgba(255,255,255,0.92)' }}>
          What Matters Most to You?
        </h1>
        <p className="text-[12px] leading-[1.6] max-w-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Pick the path that fits your lifestyle. We will tailor your meals, workouts, and supplements to match your goals.
        </p>
      </div>

      {/* Profile Cards */}
      <div className="w-full flex flex-col gap-3">
        {PROFILES.map((profile, idx) => {
          const isSelected = selected === profile.id;
          const isHardTruth = profile.id === 'hard-truth';

          return (
            <motion.button
              key={profile.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 20 }}
              transition={{ duration: 0.5, delay: 0.15 + idx * 0.1, ease: [0.4, 0, 0.2, 1] }}
              onClick={() => setSelected(profile.id)}
              className="relative w-full text-left rounded-2xl transition-all duration-400 overflow-hidden group"
              style={{
                background: isSelected
                  ? `rgba(${profile.accentRgb},0.04)`
                  : 'rgba(255,255,255,0.015)',
                border: `1.5px solid ${isSelected ? `rgba(${profile.accentRgb},0.3)` : 'rgba(255,255,255,0.05)'}`,
                boxShadow: isSelected
                  ? `0 0 40px rgba(${profile.accentRgb},0.08), inset 0 1px 0 rgba(${profile.accentRgb},0.08)`
                  : 'none',
              }}
            >
              {/* Top accent line */}
              <div
                className="absolute top-0 left-0 right-0 h-px transition-opacity duration-300"
                style={{
                  background: `linear-gradient(90deg, transparent, rgba(${profile.accentRgb},${isSelected ? 0.4 : 0.1}), transparent)`,
                }}
              />

              {/* Classified corner badge */}
              {isHardTruth && (
                <div
                  className="absolute top-3 right-3 px-1.5 py-0.5 rounded"
                  style={{
                    background: isSelected ? 'rgba(255,68,68,0.12)' : 'rgba(255,68,68,0.06)',
                    border: `1px solid ${isSelected ? 'rgba(255,68,68,0.25)' : 'rgba(255,68,68,0.1)'}`,
                  }}
                >
                  <span className="text-[7px] font-bold uppercase tracking-[0.2em]" style={{ color: isSelected ? '#FF4444' : 'rgba(255,68,68,0.4)' }}>
                    Restricted
                  </span>
                </div>
              )}

              {/* Selection radio */}
              {!isHardTruth && (
                <div
                  className="absolute top-4 right-4 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    background: isSelected ? `rgba(${profile.accentRgb},0.12)` : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${isSelected ? profile.accent : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: profile.accent, boxShadow: `0 0 8px rgba(${profile.accentRgb},0.6)` }}
                      />
                    )}
                  </AnimatePresence>
                </div>
              )}

              <div className="p-4 pb-2">
                <div className="flex items-start gap-3.5">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {profile.icon(isSelected)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    {/* Codename */}
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[8px] font-bold uppercase tracking-[0.2em] px-1.5 py-0.5 rounded"
                        style={{
                          background: isSelected ? `rgba(${profile.accentRgb},0.1)` : 'rgba(255,255,255,0.03)',
                          color: isSelected ? profile.accent : 'rgba(255,255,255,0.2)',
                          border: `1px solid ${isSelected ? `rgba(${profile.accentRgb},0.15)` : 'rgba(255,255,255,0.04)'}`,
                        }}
                      >
                        {profile.codename}
                      </span>
                    </div>

                    {/* Title + Subtitle */}
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span
                        className="text-[15px] font-semibold tracking-tight"
                        style={{ color: isSelected ? profile.accent : 'rgba(255,255,255,0.75)' }}
                      >
                        {profile.title}
                      </span>
                      <span
                        className="text-[10px] font-medium tracking-wide"
                        style={{ color: isSelected ? `rgba(${profile.accentRgb},0.6)` : 'rgba(255,255,255,0.2)' }}
                      >
                        {profile.subtitle}
                      </span>
                    </div>

                    {/* Description */}
                    <p
                      className="text-[11px] leading-[1.6] mb-2.5"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.3)' }}
                    >
                      {profile.description}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {profile.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[8px] font-semibold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full"
                          style={{
                            background: isSelected ? `rgba(${profile.accentRgb},0.08)` : 'rgba(255,255,255,0.02)',
                            color: isSelected ? `rgba(${profile.accentRgb},0.7)` : 'rgba(255,255,255,0.2)',
                            border: `1px solid ${isSelected ? `rgba(${profile.accentRgb},0.12)` : 'rgba(255,255,255,0.04)'}`,
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Macro Preview — only shown when selected */}
              <div className="px-4 pb-4">
                <MacroPreviewBar profile={profile.id} visible={isSelected} />
              </div>

              {/* Bottom scan line when selected */}
              {isSelected && (
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-px"
                  style={{
                    background: `linear-gradient(90deg, transparent, rgba(${profile.accentRgb},0.3), transparent)`,
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Confirm */}
      <div className="w-full flex flex-col items-center gap-3 pt-1">
        <button
          onClick={handleConfirm}
          disabled={!selected || confirmed}
          className="w-full py-3.5 rounded-xl text-[13px] font-semibold tracking-wide uppercase transition-all duration-300"
          style={{
            background: selected
              ? selected === 'hard-truth'
                ? 'rgba(255,68,68,0.12)'
                : selected === 'elite'
                  ? 'rgba(0,240,255,0.12)'
                  : 'rgba(0,255,204,0.12)'
              : 'rgba(255,255,255,0.03)',
            border: `1.5px solid ${
              selected
                ? selected === 'hard-truth'
                  ? 'rgba(255,68,68,0.3)'
                  : selected === 'elite'
                    ? 'rgba(0,240,255,0.3)'
                    : 'rgba(0,255,204,0.3)'
                : 'rgba(255,255,255,0.06)'
            }`,
            color: selected
              ? selected === 'hard-truth'
                ? '#FF4444'
                : selected === 'elite'
                  ? '#00F0FF'
                  : '#00FFCC'
              : 'rgba(255,255,255,0.2)',
            boxShadow: selected
              ? `0 0 20px rgba(${PROFILES.find(p => p.id === selected)?.accentRgb || '0,240,255'},0.1)`
              : 'none',
            cursor: selected ? 'pointer' : 'not-allowed',
            opacity: confirmed ? 0.5 : 1,
          }}
        >
          {confirmed ? 'Setting Up...' : selected === 'hard-truth' ? 'Start The Hard Path' : 'Start My Plan'}
        </button>

        <button
          onClick={onBack}
          className="text-[11px] tracking-wider transition-all duration-200"
          style={{ color: 'rgba(255,255,255,0.2)' }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}
        >
          Back
        </button>
      </div>
    </motion.div>
  );
}


/* ═══════════════════════════════════════════════════════════
   STEP 4 — Personalize (Core vs Elite UI density)
   ═══════════════════════════════════════════════════════════ */

function CoreIcon({ selected }: { selected: boolean }) {
  const stroke = selected ? '#00F0FF' : 'rgba(255,255,255,0.3)';
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="24" stroke={stroke} strokeWidth="1.5" strokeDasharray={selected ? 'none' : '4 3'} opacity={selected ? 1 : 0.6} />
      <circle cx="28" cy="28" r="6" fill={selected ? '#00F0FF' : 'rgba(255,255,255,0.15)'} opacity={selected ? 0.9 : 0.5} />
      <path d="M12 28 H20 L23 22 L26 34 L29 25 L32 28 H44" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={selected ? 0.8 : 0.35} />
      {selected && <circle cx="28" cy="28" r="6" fill="#00F0FF" opacity="0.2" filter="url(#coreGlowP)" />}
      <defs><filter id="coreGlowP" x="14" y="14" width="28" height="28" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="4" /></filter></defs>
    </svg>
  );
}

function EliteIcon({ selected }: { selected: boolean }) {
  const stroke = selected ? '#00F0FF' : 'rgba(255,255,255,0.3)';
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <path d="M18 8 C18 16, 38 16, 38 24 C38 32, 18 32, 18 40 C18 48, 38 48, 38 48" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" opacity={selected ? 0.9 : 0.4} />
      <path d="M38 8 C38 16, 18 16, 18 24 C18 32, 38 32, 38 40 C38 48, 18 48, 18 48" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" opacity={selected ? 0.9 : 0.4} />
      {[12, 20, 28, 36, 44].map((y, i) => (
        <line key={i} x1={22 - (i % 2 === 0 ? 0 : 2)} y1={y} x2={34 + (i % 2 === 0 ? 0 : 2)} y2={y} stroke={stroke} strokeWidth="1" opacity={selected ? 0.6 : 0.2} />
      ))}
      {selected && [16, 24, 32, 40].map((y, i) => (
        <circle key={i} cx="28" cy={y} r="2" fill="#00F0FF" opacity={0.8 - i * 0.15} />
      ))}
      {selected && <rect x="16" y="6" width="24" height="44" rx="12" fill="#00F0FF" opacity="0.04" filter="url(#eliteGlowP)" />}
      <defs><filter id="eliteGlowP" x="8" y="0" width="40" height="56" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="6" /></filter></defs>
    </svg>
  );
}

function PersonalizeStep({ onContinue, onBack }: { onContinue: (style: UserStyle) => void; onBack: () => void }) {
  const [selected, setSelected] = useState<UserStyle | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const options: { id: UserStyle; label: string; sublabel: string; description: string; icon: (sel: boolean) => React.ReactNode }[] = [
    {
      id: 'core',
      label: 'Core',
      sublabel: 'Easy to Read',
      description: "Just the essentials. Clear daily guidance, simple insights, and easy voice logging to keep you on track.",
      icon: (sel) => <CoreIcon selected={sel} />,
    },
    {
      id: 'elite',
      label: 'Elite',
      sublabel: 'Full Detail',
      description: "See everything. Full health records, lab results, and detailed biometric trends for those who love the data.",
      icon: (sel) => <EliteIcon selected={sel} />,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: mounted ? 1 : 0, x: mounted ? 0 : 40 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="w-full max-w-md flex flex-col items-center gap-8 relative z-10"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style={{ background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.15)', boxShadow: '0 0 20px rgba(0,240,255,0.1)' }}>
          <span className="text-sm font-bold" style={{ color: '#00F0FF' }}>V</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'rgba(255,255,255,0.92)' }}>
          How Should Vive Look?
        </h1>
        <p className="text-[13px] leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
          Pick the view that feels right for you. You can always switch later in Settings.
        </p>
      </div>

      <div className="w-full flex flex-col gap-3">
        {options.map((opt, idx) => {
          const isSelected = selected === opt.id;
          return (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 16 }}
              transition={{ duration: 0.5, delay: 0.15 + idx * 0.1, ease: [0.4, 0, 0.2, 1] }}
              onClick={() => setSelected(opt.id)}
              className="relative w-full flex items-start gap-4 p-5 rounded-2xl text-left transition-all duration-300 group"
              style={{
                background: isSelected ? 'rgba(0,240,255,0.06)' : 'rgba(255,255,255,0.02)',
                border: `1.5px solid ${isSelected ? 'rgba(0,240,255,0.35)' : 'rgba(255,255,255,0.06)'}`,
                boxShadow: isSelected ? '0 0 30px rgba(0,240,255,0.08), inset 0 1px 0 rgba(0,240,255,0.1)' : 'none',
              }}
            >
              <div className="absolute top-4 right-4 w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300" style={{ background: isSelected ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${isSelected ? '#00F0FF' : 'rgba(255,255,255,0.1)'}` }}>
                <AnimatePresence>
                  {isSelected && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }} className="w-2.5 h-2.5 rounded-full" style={{ background: '#00F0FF', boxShadow: '0 0 8px rgba(0,240,255,0.6)' }} />
                  )}
                </AnimatePresence>
              </div>
              <div className="flex-shrink-0 mt-0.5">{opt.icon(isSelected)}</div>
              <div className="flex flex-col gap-1.5 pr-8">
                <div className="flex items-baseline gap-2">
                  <span className="text-[15px] font-semibold tracking-tight" style={{ color: isSelected ? '#00F0FF' : 'rgba(255,255,255,0.8)' }}>{opt.label}</span>
                  <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: isSelected ? 'rgba(0,240,255,0.6)' : 'rgba(255,255,255,0.25)' }}>{opt.sublabel}</span>
                </div>
                <p className="text-[12px] leading-[1.6]" style={{ color: isSelected ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)' }}>{opt.description}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      <div className="w-full flex flex-col items-center gap-3">
        <button onClick={() => selected && onContinue(selected)} disabled={!selected} className="w-full py-3.5 rounded-xl text-[13px] font-semibold tracking-wide uppercase transition-all duration-300" style={{ background: selected ? 'rgba(0,240,255,0.12)' : 'rgba(255,255,255,0.03)', border: `1.5px solid ${selected ? 'rgba(0,240,255,0.3)' : 'rgba(255,255,255,0.06)'}`, color: selected ? '#00F0FF' : 'rgba(255,255,255,0.2)', boxShadow: selected ? '0 0 20px rgba(0,240,255,0.1)' : 'none', cursor: selected ? 'pointer' : 'not-allowed' }}>
          Start My Day
        </button>
        <button onClick={onBack} className="text-[11px] tracking-wider transition-all duration-200" style={{ color: 'rgba(255,255,255,0.2)' }} onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }} onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.2)'; }}>
          Back
        </button>
      </div>
    </motion.div>
  );
}


/* ═══════════════════════════════════════════════════════════
   MAIN ONBOARDING ORCHESTRATOR
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   BIO-IDENTITY SUMMARY CARD — Metabolic Score Ring
   Appears after vitals entry with FluidCanvas aesthetics
   ═══════════════════════════════════════════════════════════ */

function MetabolicScoreRing({ score, color, glowColor }: { score: number; color: string; glowColor: string }) {
  const radius = 68;
  const strokeWidth = 5;
  const { circumference, strokeDashoffset } = getScoreRingProps(score, radius);
  const center = radius + strokeWidth + 4;
  const size = center * 2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer glow pulse */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: [
            `0 0 30px ${glowColor}0.08)`,
            `0 0 60px ${glowColor}0.15)`,
            `0 0 30px ${glowColor}0.08)`,
          ],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth}
        />
        {/* Ambient glow ring */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke={`${glowColor}0.06)`} strokeWidth={strokeWidth + 8}
          filter="url(#ringGlow)"
        />
        {/* Progress arc */}
        <motion.circle
          cx={center} cy={center} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 2, delay: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        />
        {/* Glow duplicate */}
        <motion.circle
          cx={center} cy={center} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth + 2}
          strokeLinecap="round" opacity={0.15}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 2, delay: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
          filter="url(#ringGlow)"
        />
        <defs>
          <filter id="ringGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
        <motion.span
          className="text-[32px] font-bold tracking-tight font-mono"
          style={{ color }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 1.2 }}
        >
          {score}
        </motion.span>
        <motion.span
          className="text-[8px] font-semibold uppercase tracking-[0.25em] mt-0.5"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          Metabolic Score
        </motion.span>
      </div>
    </div>
  );
}

function BioIdentityCard({
  vitalsData,
  onInitialize,
}: {
  vitalsData: VitalsData;
  onInitialize: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [particlesActive, setParticlesActive] = useState(false);

  const metabolicScore = calculateMetabolicScoreFromVitals(vitalsData);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleInitialize = () => {
    setInitializing(true);
    setParticlesActive(true);
    setTimeout(() => onInitialize(), 1800);
  };

  const subScores = [
    { label: 'BMR Efficiency', value: metabolicScore.components.bmrEfficiency, icon: '\u{1F525}' },
    { label: 'Body Composition', value: metabolicScore.components.bodyComposition, icon: '\u{1F4AA}' },
    { label: 'Metabolic Flex', value: metabolicScore.components.metabolicFlexibility, icon: '\u26A1' },
    { label: 'Vitality Factor', value: metabolicScore.components.vitalityFactor, icon: '\u{1F9EC}' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: mounted ? 1 : 0, y: mounted ? 0 : 30 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
      className="w-full max-w-md flex flex-col items-center gap-6 relative z-10"
    >
      {/* Ambient background glow matching FluidCanvas */}
      <div
        className="absolute -top-20 left-1/2 -translate-x-1/2 w-[400px] h-[400px] pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, ${metabolicScore.glowColor}0.06) 0%, transparent 70%)`,
          filter: 'blur(60px)',
        }}
      />

      {/* Particle burst on initialize */}
      <AnimatePresence>
        {particlesActive && Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={`particle-${i}`}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 3 + Math.random() * 4,
              height: 3 + Math.random() * 4,
              background: metabolicScore.color,
              left: '50%',
              top: '40%',
            }}
            initial={{ opacity: 0.8, scale: 1, x: 0, y: 0 }}
            animate={{
              opacity: 0,
              scale: 0.3,
              x: (Math.random() - 0.5) * 300,
              y: (Math.random() - 0.5) * 300,
            }}
            transition={{ duration: 1.2 + Math.random() * 0.6, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col items-center gap-2 text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex items-center gap-2"
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: metabolicScore.color, boxShadow: `0 0 8px ${metabolicScore.glowColor}0.5)` }} />
          <span className="text-[9px] font-mono uppercase tracking-[0.2em]" style={{ color: `${metabolicScore.glowColor}0.6)` }}>Bio-Identity Computed</span>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: metabolicScore.color, boxShadow: `0 0 8px ${metabolicScore.glowColor}0.5)` }} />
        </motion.div>
        <motion.h1
          className="text-xl font-semibold tracking-tight"
          style={{ color: 'rgba(255,255,255,0.92)' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Your Metabolic Blueprint
        </motion.h1>
      </div>

      {/* High-glow container */}
      <motion.div
        className="relative w-full rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(10,10,16,0.85)',
          border: `1px solid ${metabolicScore.glowColor}0.15)`,
          boxShadow: `0 0 60px ${metabolicScore.glowColor}0.06), inset 0 1px 0 ${metabolicScore.glowColor}0.08)`,
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${metabolicScore.glowColor}0.3), transparent)` }} />

        {/* Score ring */}
        <div className="flex flex-col items-center pt-8 pb-4">
          <MetabolicScoreRing
            score={metabolicScore.score}
            color={metabolicScore.color}
            glowColor={metabolicScore.glowColor}
          />

          {/* Grade badge */}
          <motion.div
            className="mt-3 px-3 py-1 rounded-full"
            style={{
              background: `${metabolicScore.glowColor}0.08)`,
              border: `1px solid ${metabolicScore.glowColor}0.2)`,
            }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.8 }}
          >
            <span className="text-[10px] font-bold tracking-[0.15em]" style={{ color: metabolicScore.color }}>
              GRADE {metabolicScore.grade}
            </span>
          </motion.div>
        </div>

        {/* Sub-scores grid */}
        <div className="grid grid-cols-2 gap-px mx-4 mb-4 rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {subScores.map((sub, idx) => (
            <motion.div
              key={sub.label}
              className="flex items-center gap-2.5 p-3"
              style={{ background: 'rgba(8,8,14,0.9)' }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2 + idx * 0.1 }}
            >
              <span className="text-sm">{sub.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{sub.label}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: metabolicScore.color }}
                      initial={{ width: '0%' }}
                      animate={{ width: `${sub.value}%` }}
                      transition={{ duration: 1, delay: 2.2 + idx * 0.15, ease: [0.25, 0.1, 0.25, 1] }}
                    />
                  </div>
                  <span className="text-[10px] font-mono font-bold" style={{ color: metabolicScore.color }}>{sub.value}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Insight */}
        <motion.div
          className="mx-4 mb-5 p-3 rounded-xl"
          style={{ background: `${metabolicScore.glowColor}0.03)`, border: `1px solid ${metabolicScore.glowColor}0.08)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.6 }}
        >
          <motion.p
            className="text-[11px] leading-[1.7] text-center"
            style={{ color: 'rgba(255,255,255,0.55)' }}
            animate={{ opacity: [0.55, 0.75, 0.55] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            {metabolicScore.insight}
          </motion.p>
        </motion.div>

        {/* Bottom accent */}
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${metabolicScore.glowColor}0.2), transparent)` }} />
      </motion.div>

      {/* Initialize My Human OS button */}
      <motion.button
        onClick={handleInitialize}
        disabled={initializing}
        className="w-full py-4 rounded-xl text-[13px] font-semibold tracking-[0.1em] uppercase transition-all duration-300 relative overflow-hidden"
        style={{
          background: initializing ? `${metabolicScore.glowColor}0.06)` : `${metabolicScore.glowColor}0.1)`,
          border: `1.5px solid ${metabolicScore.glowColor}${initializing ? '0.15)' : '0.3)'}`,
          color: initializing ? 'rgba(255,255,255,0.4)' : metabolicScore.color,
          boxShadow: initializing ? 'none' : `0 0 30px ${metabolicScore.glowColor}0.12)`,
          cursor: initializing ? 'not-allowed' : 'pointer',
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.8 }}
        whileHover={!initializing ? { scale: 1.02, boxShadow: `0 0 50px ${metabolicScore.glowColor}0.2)` } : undefined}
        whileTap={!initializing ? { scale: 0.98 } : undefined}
      >
        {/* Sweep animation on initialize */}
        {initializing && (
          <motion.div
            className="absolute inset-0"
            style={{ background: `linear-gradient(90deg, transparent, ${metabolicScore.glowColor}0.15), transparent)` }}
            initial={{ x: '-100%' }}
            animate={{ x: '200%' }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          />
        )}
        <span className="relative z-10">
          {initializing ? 'Initializing Human OS...' : 'Initialize My Human OS'}
        </span>
      </motion.button>

      {/* Vitals summary chips */}
      <motion.div
        className="flex flex-wrap justify-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3 }}
      >
        {[
          { label: 'Age', value: vitalsData.age },
          { label: 'Weight', value: `${vitalsData.weight} ${vitalsData.unit}` },
          vitalsData.goalWeight ? { label: 'Goal', value: `${vitalsData.goalWeight} ${vitalsData.unit}` } : null,
        ].filter(Boolean).map((chip) => (
          <div
            key={chip!.label}
            className="px-2.5 py-1 rounded-full text-[9px] font-mono"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}
          >
            {chip!.label}: {chip!.value}
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}


type OnboardingStep = 'vitals' | 'bio-identity' | 'sync' | 'mission' | 'personalize';

function OnboardingFlow() {
  const navigate = useNavigate();
  const updateBaselines = useMutation(api.mutations.updateUserBaselines);
  const [step, setStep] = useState<OnboardingStep>('vitals');
  const [vitalsData, setVitalsData] = useState<VitalsData | null>(null);
  const [missionProfile, setMissionProfile] = useState<MissionProfile | null>(null);
  const [confirming, setConfirming] = useState(false);

  const totalSteps = 5;
  const currentStepNum = step === 'vitals' ? 1 : step === 'bio-identity' ? 2 : step === 'sync' ? 3 : step === 'mission' ? 4 : 5;

  const handleVitalsComplete = (data: VitalsData) => {
    setVitalsData(data);

    // Compute BioLogic baselines and persist to Convex
    const sessionId = getTwinSessionId();

    const age = parseInt(data.age, 10) || 30;
    const rawWeight = parseFloat(data.weight) || 170;
    const weightKg = data.unit === 'lbs' ? rawWeight * 0.453592 : rawWeight;
    // Map onboarding gender to BioLogic sex
    const sexMap: Record<string, BiologicalSex> = {
      male: 'male',
      female: 'female',
      other: 'intersex',
      prefer_not: 'prefer_not',
    };
    const sex: BiologicalSex = sexMap[data.gender ?? 'prefer_not'] ?? 'prefer_not';
    // Estimate height from weight if not collected (average proportional estimate)
    const heightCm = sex === 'female' ? 163 : sex === 'male' ? 178 : 170;

    const baselines = computeAllBaselines({ sex, age, heightCm, weightKg });
    const serialized = serializeBaselines(baselines);

    // Fire-and-forget — don't block onboarding flow
    updateBaselines({
      sessionId,
      sex,
      age,
      heightCm,
      weightKg,
      computedBaselines: serialized,
    }).catch((err) => console.warn('Failed to save baselines:', err));

    setStep('bio-identity');
  };

  const handleBioIdentityComplete = () => {
    setStep('sync');
  };

  const handleSyncComplete = () => {
    setStep('mission');
  };

  const handleMissionComplete = (profile: MissionProfile) => {
    setMissionProfile(profile);
    setGlobalMissionProfile(profile);
    setStep('personalize');
  };

  const handlePersonalizeComplete = (style: UserStyle) => {
    setConfirming(true);
    setGlobalUserStyle(style);
    setOnboardingComplete();

    if (vitalsData) {
      sessionStorage.setItem('vive-user-vitals', JSON.stringify(vitalsData));
    }
    if (missionProfile) {
      sessionStorage.setItem('vive-mission-profile', missionProfile);
    }

    setTimeout(() => {
      navigate({ to: '/' });
    }, 600);
  };

  const stepLabels = ['Vitals', 'Bio-ID', 'Sync', 'Mission', 'Style'];

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #050508 0%, #0A0A12 40%, #080810 70%, #050508 100%)',
      }}
    >
      {/* Ambient glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(0,240,255,0.04) 0%, transparent 70%)', filter: 'blur(80px)' }} />

      {/* Step indicator */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5 z-20"
      >
        {Array.from({ length: totalSteps }).map((_, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === currentStepNum;
          const isComplete = stepNum < currentStepNum;
          return (
            <div key={i} className="flex items-center gap-2.5">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all duration-500"
                  style={{
                    background: isActive ? 'rgba(0,240,255,0.15)' : isComplete ? 'rgba(0,240,255,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${isActive ? 'rgba(0,240,255,0.5)' : isComplete ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    color: isActive ? '#00F0FF' : isComplete ? 'rgba(0,240,255,0.5)' : 'rgba(255,255,255,0.2)',
                    boxShadow: isActive ? '0 0 12px rgba(0,240,255,0.2)' : 'none',
                  }}
                >
                  {isComplete ? '\u2713' : stepNum}
                </div>
                <span className="text-[7px] font-semibold uppercase tracking-wider" style={{ color: isActive ? 'rgba(0,240,255,0.6)' : 'rgba(255,255,255,0.15)' }}>
                  {stepLabels[i]}
                </span>
              </div>
              {i < totalSteps - 1 && (
                <div className="w-6 h-px mb-3" style={{ background: isComplete ? 'rgba(0,240,255,0.3)' : 'rgba(255,255,255,0.06)' }} />
              )}
            </div>
          );
        })}
      </motion.div>

      {/* Confirming overlay */}
      <AnimatePresence>
        {confirming && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(5,5,8,0.9)' }}>
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4 }} className="flex flex-col items-center gap-3">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="w-8 h-8 border-2 border-t-transparent rounded-full" style={{ borderColor: 'rgba(0,240,255,0.4)', borderTopColor: 'transparent' }} />
              <span className="text-[11px] tracking-wider" style={{ color: 'rgba(0,240,255,0.6)' }}>
                Setting up your personalized plan...
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step content */}
      <AnimatePresence mode="wait">
        {step === 'vitals' && (
          <VitalsStep key="vitals" onContinue={handleVitalsComplete} />
        )}
        {step === 'bio-identity' && vitalsData && (
          <BioIdentityCard key="bio-identity" vitalsData={vitalsData} onInitialize={handleBioIdentityComplete} />
        )}
        {step === 'sync' && (
          <SyncLabScreen key="sync" onContinue={handleSyncComplete} onBack={() => setStep('vitals')} />
        )}
        {step === 'mission' && (
          <MissionProfileStep key="mission" onContinue={handleMissionComplete} onBack={() => setStep('sync')} />
        )}
        {step === 'personalize' && (
          <PersonalizeStep key="personalize" onContinue={handlePersonalizeComplete} onBack={() => setStep('mission')} />
        )}
      </AnimatePresence>
    </div>
  );
}

export const Route = createFileRoute('/onboarding/personalize')({ component: OnboardingFlow });
