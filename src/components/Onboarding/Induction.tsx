import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';

import { getTwinSessionId } from '@/lib/twinSession'
/* ═══════════════════════════════════════════════════════════
   VIVE 4.0 — INSTANT INDUCTION DROP ZONE
   Zero-form onboarding: Drop health data → AI parses → BioVault populated → Protocol ready
   Goal: App Open → Personalized Protocol in <30 seconds
   ═══════════════════════════════════════════════════════════ */

export type InductionStep = 'north-star' | 'sleep-goal' | 'supplements' | 'weight-target' | 'access-gate' | 'initializing';

export interface InductionResult {
  northStar: string;
  sleepGoalHours: number;
  primarySupplements: string[];
  targetWeight?: number;
  weightUnit: string;
  accessCode?: string;
}

const CYAN = '#00F0FF';
const GREEN = '#00ffaa';
const PURPLE = '#BF5AF2';

const T = {
  bg: '#06060A',
  surface: 'rgba(12,12,18,0.85)',
  elevated: 'rgba(18,18,26,0.92)',
  text: '#F0F0F4',
  textSec: 'rgba(255,255,255,0.55)',
  textTer: 'rgba(255,255,255,0.28)',
  cyan: CYAN,
  cyanDim: 'rgba(0,240,255,0.12)',
  cyanGlow: 'rgba(0,240,255,0.06)',
  green: GREEN,
  greenDim: 'rgba(0,255,204,0.12)',
  orange: '#FF8C00',
  orangeDim: 'rgba(255,140,0,0.12)',
  purple: PURPLE,
  purpleDim: 'rgba(191,90,242,0.12)',
  red: '#FF6B6B',
  border: 'rgba(255,255,255,0.06)',
  borderActive: 'rgba(0,240,255,0.25)',
};

type Phase = 'drop' | 'scanning' | 'review' | 'deploying' | 'complete';

interface ParsedProfile {
  biomarkers: Record<string, number | null>;
  additionalBiomarkers: Array<{ name: string; value: number; unit: string }>;
  vitals: { age: number | null; gender: string | null; weight: number | null; weightUnit: string };
  supplements: string[];
  geneticFlags: { mthfrVariant: boolean; apoe4: boolean; caffeineSensitivity: boolean };
  diet: { preferredProteins: string; dietaryRestrictions: string };
  sleepHours: number | null;
  northStar: { goal: string; confidence: number; reason: string };
  dataQuality: { level: string; note: string; analytesExtracted: number };
}

const NORTH_STAR_META: Record<string, { label: string; icon: string; color: string; colorRgb: string }> = {
  longevity: { label: 'Longevity', icon: '\u267E', color: '#00FFCC', colorRgb: '0,255,204' },
  'peak-output': { label: 'Peak Output', icon: '\u26A1', color: '#00F0FF', colorRgb: '0,240,255' },
  recovery: { label: 'Recovery', icon: '\uD83D\uDD04', color: '#7B68EE', colorRgb: '123,104,238' },
  'body-recomp': { label: 'Body Recomp', icon: '\uD83D\uDD25', color: '#FF6B35', colorRgb: '255,107,53' },
};

const SUPPLEMENT_MAP: Record<string, string> = {
  'omega-3 fish oil': 'omega-3', 'fish oil': 'omega-3', 'omega-3': 'omega-3',
  'vitamin d3': 'vitamin-d3', 'vitamin d': 'vitamin-d3', 'vitamin d3 + k2': 'vitamin-d3',
  'magnesium glycinate': 'magnesium', 'magnesium': 'magnesium',
  'creatine monohydrate': 'creatine', 'creatine': 'creatine',
  'ashwagandha': 'ashwagandha', 'ashwagandha ksm-66': 'ashwagandha',
  'zinc': 'zinc', 'zinc picolinate': 'zinc',
  'l-theanine': 'l-theanine', 'probiotics': 'probiotics',
  'collagen': 'collagen', 'collagen peptides': 'collagen',
  'melatonin': 'melatonin', 'b-complex': 'b-complex',
  'turmeric': 'turmeric', 'curcumin': 'turmeric',
  'nmn': 'nmn', 'nad+': 'nmn', 'resveratrol': 'resveratrol',
  'berberine': 'berberine', 'coq10': 'coq10',
};

function mapSupps(names: string[]): string[] {
  const ids = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase().trim();
    if (SUPPLEMENT_MAP[key]) { ids.add(SUPPLEMENT_MAP[key]); continue; }
    for (const [pattern, id] of Object.entries(SUPPLEMENT_MAP)) {
      if (key.includes(pattern) || pattern.includes(key)) { ids.add(id); break; }
    }
  }
  return Array.from(ids);
}

/* ── Particle Background ── */
function Particles() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 2 + Math.random() * 3, height: 2 + Math.random() * 3,
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            background: i % 3 === 0 ? CYAN : i % 3 === 1 ? GREEN : 'rgba(255,255,255,0.15)',
            opacity: 0.1 + Math.random() * 0.2,
            animation: `inductionFloat ${8 + Math.random() * 12}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes inductionFloat {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.1; }
          25% { transform: translateY(-30px) translateX(10px); opacity: 0.3; }
          50% { transform: translateY(-15px) translateX(-8px); opacity: 0.15; }
          75% { transform: translateY(-40px) translateX(15px); opacity: 0.25; }
        }
        @keyframes scanPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0,240,255,0.1); }
          50% { box-shadow: 0 0 60px rgba(0,240,255,0.25); }
        }
        @keyframes scanLine {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }
      `}</style>
    </div>
  );
}

/* ── Scan Animation Overlay ── */
function ScanOverlay() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 20, zIndex: 2 }}>
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)`,
        boxShadow: `0 0 30px 10px ${T.cyanDim}`,
        animation: 'scanLine 2.5s linear infinite',
      }} />
      {[...Array(8)].map((_, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: [0, 0.5, 0], x: [0, 180] }}
          transition={{ duration: 1.2, delay: i * 0.25, repeat: Infinity }}
          style={{
            position: 'absolute', top: 20 + i * 35, left: 16,
            height: 1, width: 50 + Math.random() * 80, borderRadius: 1,
            background: `${CYAN}40`,
          }}
        />
      ))}
    </motion.div>
  );
}

/* ── Biomarker Mini Card ── */
function BioCard({ name, value, unit, status }: { name: string; value: number; unit: string; status: 'optimal' | 'warning' | 'critical' }) {
  const color = status === 'optimal' ? T.green : status === 'warning' ? T.orange : T.red;
  const bg = status === 'optimal' ? T.greenDim : status === 'warning' ? T.orangeDim : 'rgba(255,107,107,0.12)';
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      style={{ padding: '7px 10px', borderRadius: 10, background: bg, border: `1px solid ${color}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
      <span style={{ fontSize: 10, color: T.textSec, fontFamily: 'monospace' }}>{name}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
        <span style={{ fontSize: 8, color: T.textTer }}>{unit}</span>
      </div>
    </motion.div>
  );
}

/* ── Optimal Ranges for status assessment ── */
const RANGES: Record<string, { min?: number; max?: number; unit: string; label: string }> = {
  vitaminD: { min: 40, max: 80, unit: 'ng/mL', label: 'Vitamin D' },
  ferritin: { min: 40, max: 200, unit: 'ng/mL', label: 'Ferritin' },
  crp: { max: 1.0, unit: 'mg/L', label: 'hs-CRP' },
  hba1c: { max: 5.6, unit: '%', label: 'HbA1c' },
  testosteroneTotal: { min: 400, max: 900, unit: 'ng/dL', label: 'Testosterone' },
  testosteroneFree: { min: 10, max: 25, unit: 'pg/mL', label: 'Free T' },
  igf1: { min: 100, max: 250, unit: 'ng/mL', label: 'IGF-1' },
  fastingGlucose: { min: 70, max: 95, unit: 'mg/dL', label: 'Glucose' },
};

function getStatus(key: string, val: number): 'optimal' | 'warning' | 'critical' {
  const r = RANGES[key];
  if (!r) return 'optimal';
  if (r.min != null && r.max != null) {
    if (val < r.min * 0.75 || val > r.max * 1.25) return 'critical';
    if (val < r.min || val > r.max) return 'warning';
  } else if (r.max != null) {
    if (val > r.max * 1.5) return 'critical';
    if (val > r.max) return 'warning';
  } else if (r.min != null) {
    if (val < r.min * 0.75) return 'critical';
    if (val < r.min) return 'warning';
  }
  return 'optimal';
}

/* ═══════════════════════════════════════════════════════════
   MAIN INDUCTION — UNIFIED DROP ZONE
   ═══════════════════════════════════════════════════════════ */

interface InductionProps {
  onComplete: (result: InductionResult) => void;
}

export default function Induction({ onComplete }: InductionProps) {
  const [phase, setPhase] = useState<Phase>('drop');
  const [dragOver, setDragOver] = useState(false);
  const [profile, setProfile] = useState<ParsedProfile | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanPhaseText, setScanPhaseText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const instantParse = useAction(api.instantOnboard.instantParse);
  const upsertBioVault = useMutation(api.mutations.upsertBioVault);
  const upsertUserVitals = useMutation(api.mutations.upsertUserVitals);
  const upsertInduction = useMutation(api.mutations.upsertInductionProfile);

  /* ── Scan progress animation ── */
  useEffect(() => {
    if (phase !== 'scanning') return;
    const phases = ['Initializing AI Brain...', 'Extracting biomarkers...', 'Mapping supplement stack...', 'Inferring North Star...', 'Building biological profile...'];
    let progress = 0;
    const interval = setInterval(() => {
      progress += 1.5 + Math.random() * 2;
      if (progress > 95) progress = 95;
      setScanProgress(progress);
      const idx = Math.min(Math.floor(progress / 22), phases.length - 1);
      setScanPhaseText(phases[idx]);
    }, 80);
    return () => clearInterval(interval);
  }, [phase]);

  /* ── Process any text through AI Brain ── */
  const processData = useCallback(async (text: string, name: string, inputType: string) => {
    setPhase('scanning');
    setFileName(name);
    setError(null);
    setScanProgress(0);
    try {
      const result = await instantParse({ rawText: text, inputType });
      if (!result.success || !result.data) {
        setError('Extraction failed. Try pasting the text directly.');
        setPhase('drop');
        return;
      }
      setScanProgress(100);
      setScanPhaseText('Profile complete.');
      await new Promise(r => setTimeout(r, 400));
      setProfile(result.data as ParsedProfile);
      setSelectedGoal(result.data.northStar?.goal || 'longevity');
      setPhase('review');
    } catch (err: any) {
      setError(err?.message || 'Extraction failed');
      setPhase('drop');
    }
  }, [instantParse]);

  /* ── File handler ── */
  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const inputType = file.type.includes('image') ? 'supplement_list' : file.name.endsWith('.csv') ? 'lab_report' : 'mixed';
      await processData(text, file.name, inputType);
    } catch {
      setError('Could not read file. Try pasting the text instead.');
      setPhase('drop');
    }
  }, [processData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handlePaste = useCallback((text: string) => {
    if (text.trim().length < 10) return;
    processData(text, 'Pasted data', 'free_text');
  }, [processData]);

  /* ── Deploy to BioVault + complete onboarding ── */
  const handleDeploy = useCallback(async () => {
    if (!profile || !selectedGoal) return;
    setPhase('deploying');
    const sessionId = getTwinSessionId();

    try {
      const bm = profile.biomarkers;
      await upsertBioVault({
        sessionId,
        vitaminD: bm.vitaminD ?? undefined,
        testosteroneFree: bm.testosteroneFree ?? undefined,
        testosteroneTotal: bm.testosteroneTotal ?? undefined,
        ferritin: bm.ferritin ?? undefined,
        crp: bm.crp ?? undefined,
        hba1c: bm.hba1c ?? undefined,
        mthfrVariant: profile.geneticFlags?.mthfrVariant ?? false,
        apoe4: profile.geneticFlags?.apoe4 ?? false,
        caffeineSensitivity: profile.geneticFlags?.caffeineSensitivity ?? false,
        preferredProteins: profile.diet?.preferredProteins || 'chicken, fish, eggs',
        dietaryRestrictions: profile.diet?.dietaryRestrictions || 'none',
      });

      if (profile.vitals?.age || profile.vitals?.weight) {
        await upsertUserVitals({
          sessionId,
          age: profile.vitals.age || 30,
          gender: profile.vitals.gender || 'male',
          weight: profile.vitals.weight || 170,
          unit: profile.vitals.weightUnit || 'lbs',
        });
      }

      const mappedSupps = mapSupps(profile.supplements || []);
      await upsertInduction({
        sessionId,
        northStar: selectedGoal,
        sleepGoalHours: profile.sleepHours || 8,
        primarySupplements: mappedSupps,
        targetWeight: profile.vitals?.weight ?? undefined,
        weightUnit: profile.vitals?.weightUnit || 'lbs',
        accessCode: undefined,
      }).catch(() => {});

      setPhase('complete');
      setTimeout(() => {
        onComplete({
          northStar: selectedGoal,
          sleepGoalHours: profile.sleepHours || 8,
          primarySupplements: mappedSupps,
          targetWeight: profile.vitals?.weight ?? undefined,
          weightUnit: profile.vitals?.weightUnit || 'lbs',
        });
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save data');
      setPhase('review');
    }
  }, [profile, selectedGoal, upsertBioVault, upsertUserVitals, upsertInduction, onComplete]);

  /* ── Skip onboarding (minimal data) ── */
  const handleSkip = useCallback(() => {
    const sessionId = getTwinSessionId();
    setPhase('complete');
    setTimeout(() => {
      onComplete({
        northStar: 'longevity',
        sleepGoalHours: 8,
        primarySupplements: [],
        weightUnit: 'lbs',
      });
    }, 1200);
  }, [onComplete]);

  /* ── Biomarker entries for review ── */
  const bioEntries = profile?.biomarkers
    ? Object.entries(profile.biomarkers).filter(([, v]) => v != null && typeof v === 'number') as [string, number][]
    : [];
  const additionalEntries = profile?.additionalBiomarkers || [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-5 py-8 overflow-y-auto"
      style={{ background: 'linear-gradient(180deg, #050508 0%, #0A0A12 40%, #080810 70%, #050508 100%)' }}>
      <Particles />
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,240,255,0.04) 0%, transparent 70%)', filter: 'blur(80px)' }} />

      <div className="relative z-10 w-full max-w-md">
        <AnimatePresence mode="wait">

          {/* ═══ PHASE: DROP ZONE ═══ */}
          {phase === 'drop' && (
            <motion.div key="drop" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center gap-5">

              {/* Header */}
              <div className="text-center">
                <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.1 }}
                  className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: T.cyanGlow, border: `1px solid ${T.borderActive}`, boxShadow: `0 0 60px ${T.cyanGlow}` }}>
                  <span className="text-3xl">🧬</span>
                </motion.div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: CYAN, boxShadow: `0 0 8px ${T.cyanDim}` }} />
                  <span className="text-[9px] font-mono uppercase tracking-[0.2em]" style={{ color: `${CYAN}80` }}>Zero-Form Initialization</span>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: CYAN, boxShadow: `0 0 8px ${T.cyanDim}` }} />
                </div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: T.text }}>Drop Your Health Data</h1>
                <p className="text-xs mt-2 leading-relaxed max-w-xs mx-auto" style={{ color: T.textTer }}>
                  Lab report, supplement list, or describe your health. The AI Brain extracts everything and builds your personalized protocol instantly.
                </p>
              </div>

              {/* Drop Zone */}
              <motion.div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                animate={{
                  borderColor: dragOver ? CYAN : 'rgba(255,255,255,0.08)',
                  background: dragOver ? T.cyanGlow : 'rgba(255,255,255,0.015)',
                }}
                whileHover={{ borderColor: `${CYAN}40` }}
                className="relative w-full cursor-pointer overflow-hidden"
                style={{ padding: '36px 24px', borderRadius: 20, border: '2px dashed rgba(255,255,255,0.08)' }}>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: T.cyanGlow, border: `1px solid ${T.borderActive}` }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={CYAN} strokeWidth="1.5" strokeLinecap="round">
                      <path d="M12 16V4M12 4L8 8M12 4L16 8" />
                      <path d="M4 17V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V17" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <div className="text-[13px] font-semibold" style={{ color: T.text }}>Drop lab report, supplement photo, or any health file</div>
                    <div className="text-[10px] mt-1" style={{ color: T.textTer }}>PDF, TXT, CSV — or click to browse</div>
                  </div>
                </div>
                {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
                  <div key={pos} style={{
                    position: 'absolute',
                    top: pos.includes('top') ? 8 : undefined, bottom: pos.includes('bottom') ? 8 : undefined,
                    left: pos.includes('left') ? 8 : undefined, right: pos.includes('right') ? 8 : undefined,
                    width: 12, height: 12,
                    borderTop: pos.includes('top') ? `1px solid ${CYAN}30` : undefined,
                    borderBottom: pos.includes('bottom') ? `1px solid ${CYAN}30` : undefined,
                    borderLeft: pos.includes('left') ? `1px solid ${CYAN}30` : undefined,
                    borderRight: pos.includes('right') ? `1px solid ${CYAN}30` : undefined,
                  }} />
                ))}
                <input ref={fileRef} type="file" accept=".pdf,.txt,.csv,.png,.jpg,.jpeg" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </motion.div>

              {/* Divider */}
              <div className="flex items-center gap-3 w-full">
                <div className="flex-1 h-px" style={{ background: T.border }} />
                <span className="text-[9px] font-mono" style={{ color: T.textTer, letterSpacing: '0.1em' }}>OR PASTE TEXT</span>
                <div className="flex-1 h-px" style={{ background: T.border }} />
              </div>

              {/* Paste Area */}
              <textarea ref={textRef}
                placeholder="Paste lab results, supplement list, or describe your health status..."
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePaste((e.target as HTMLTextAreaElement).value); }}
                className="w-full rounded-xl resize-none"
                style={{
                  minHeight: 72, padding: '12px 14px', background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${T.border}`, color: T.text, fontSize: 12,
                  fontFamily: 'monospace', outline: 'none', lineHeight: 1.6,
                }}
              />

              {/* Submit pasted text */}
              <button onClick={() => { if (textRef.current) handlePaste(textRef.current.value); }}
                className="w-full py-3 rounded-xl text-[12px] font-semibold tracking-wide uppercase transition-all duration-300"
                style={{ background: `${CYAN}12`, border: `1.5px solid ${CYAN}30`, color: CYAN }}>
                Analyze & Build Protocol
              </button>

              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="w-full rounded-lg text-[11px] text-center" style={{ padding: '8px 12px', background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)', color: T.red }}>
                  {error}
                </motion.div>
              )}

              {/* Skip */}
              <button onClick={handleSkip}
                className="text-[10px] tracking-wider transition-colors duration-200"
                style={{ color: 'rgba(255,255,255,0.18)' }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.18)'; }}>
                Skip — I will add data later
              </button>

              <div className="text-[8px] font-mono text-center" style={{ color: T.textTer, lineHeight: 1.6 }}>
                {'\u2318'}+Enter to submit pasted text · Data processed securely, never shared
              </div>
            </motion.div>
          )}

          {/* ═══ PHASE: SCANNING ═══ */}
          {phase === 'scanning' && (
            <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="relative flex flex-col items-center gap-5 p-8 rounded-2xl overflow-hidden"
              style={{ background: T.surface, border: `1px solid ${T.borderActive}`, animation: 'scanPulse 2s ease-in-out infinite' }}>
              <ScanOverlay />
              <div className="relative z-10 flex flex-col items-center gap-4">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="w-14 h-14 rounded-full" style={{ border: `2px solid ${T.cyanDim}`, borderTopColor: CYAN }} />
                <div className="text-center">
                  <div className="text-[14px] font-semibold" style={{ color: CYAN }}>AI Brain Analyzing</div>
                  <div className="text-[11px] mt-1" style={{ color: T.textSec }}>{fileName}</div>
                </div>
                <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <motion.div className="h-full rounded-full" style={{
                    background: `linear-gradient(90deg, ${CYAN}, ${GREEN})`,
                    width: `${scanProgress}%`, transition: 'width 0.1s linear',
                  }} />
                </div>
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }}
                  className="text-[9px] font-mono tracking-wider" style={{ color: T.textTer }}>
                  {scanPhaseText}
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ═══ PHASE: REVIEW ═══ */}
          {(phase === 'review' || phase === 'deploying') && profile && (
            <motion.div key="review" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col gap-4 max-h-[85vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: `${CYAN}20 transparent` }}>

              {/* Header */}
              <div className="text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}
                  className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: T.greenDim, border: `1px solid rgba(0,255,204,0.3)`, boxShadow: `0 0 40px ${T.greenDim}` }}>
                  <span className="text-2xl">{'\u2713'}</span>
                </motion.div>
                <h2 className="text-xl font-bold" style={{ color: T.text }}>Profile Extracted</h2>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded" style={{
                    background: profile.dataQuality.level === 'high' ? T.greenDim : profile.dataQuality.level === 'medium' ? T.orangeDim : 'rgba(255,107,107,0.1)',
                    color: profile.dataQuality.level === 'high' ? T.green : profile.dataQuality.level === 'medium' ? T.orange : T.red,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                  }}>{profile.dataQuality.level} quality</span>
                  <span className="text-[9px] font-mono" style={{ color: T.textTer }}>
                    {profile.dataQuality.analytesExtracted} analytes · {profile.supplements?.length || 0} supplements
                  </span>
                </div>
              </div>

              {/* North Star */}
              <div className="rounded-2xl p-3.5" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                <div className="text-[9px] font-mono uppercase tracking-wider mb-2.5" style={{ color: T.textTer, letterSpacing: '0.12em' }}>
                  AI-Inferred Goal {profile.northStar.confidence > 0 && `· ${Math.round(profile.northStar.confidence * 100)}%`}
                </div>
                <div className="flex gap-2">
                  {Object.entries(NORTH_STAR_META).map(([key, meta]) => {
                    const isSelected = selectedGoal === key;
                    return (
                      <motion.button key={key} whileTap={{ scale: 0.95 }} onClick={() => setSelectedGoal(key)}
                        className="flex-1 text-center rounded-xl py-2.5 px-2 transition-all duration-200"
                        style={{
                          background: isSelected ? `rgba(${meta.colorRgb},0.06)` : 'rgba(255,255,255,0.02)',
                          border: `1.5px solid ${isSelected ? `rgba(${meta.colorRgb},0.35)` : T.border}`,
                        }}>
                        <div className="text-lg mb-1">{meta.icon}</div>
                        <div className="text-[9px] font-semibold" style={{ color: isSelected ? meta.color : T.textSec }}>{meta.label}</div>
                      </motion.button>
                    );
                  })}
                </div>
                {profile.northStar.reason && (
                  <div className="text-[10px] mt-2 leading-relaxed" style={{ color: T.textTer, fontStyle: 'italic' }}>{profile.northStar.reason}</div>
                )}
              </div>

              {/* Biomarkers */}
              {bioEntries.length > 0 && (
                <div className="rounded-2xl p-3.5" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: T.textTer }}>Biomarkers</span>
                    <div className="flex gap-2">
                      {bioEntries.filter(([k, v]) => getStatus(k, v) === 'optimal').length > 0 && (
                        <span className="text-[9px] font-mono" style={{ color: T.green }}>{'\u2713'}{bioEntries.filter(([k, v]) => getStatus(k, v) === 'optimal').length}</span>
                      )}
                      {bioEntries.filter(([k, v]) => getStatus(k, v) === 'warning').length > 0 && (
                        <span className="text-[9px] font-mono" style={{ color: T.orange }}>{'\u26A0'}{bioEntries.filter(([k, v]) => getStatus(k, v) === 'warning').length}</span>
                      )}
                      {bioEntries.filter(([k, v]) => getStatus(k, v) === 'critical').length > 0 && (
                        <span className="text-[9px] font-mono" style={{ color: T.red }}>{'\u2717'}{bioEntries.filter(([k, v]) => getStatus(k, v) === 'critical').length}</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5" style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {bioEntries.map(([key, val]) => {
                      const r = RANGES[key];
                      return <BioCard key={key} name={r?.label || key} value={val} unit={r?.unit || ''} status={getStatus(key, val)} />;
                    })}
                    {additionalEntries.map((bm, i) => (
                      <BioCard key={`add-${i}`} name={bm.name} value={bm.value} unit={bm.unit} status="optimal" />
                    ))}
                  </div>
                </div>
              )}

              {/* Supplements */}
              {profile.supplements && profile.supplements.length > 0 && (
                <div className="rounded-2xl p-3.5" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
                  <div className="text-[9px] font-mono uppercase tracking-wider mb-2" style={{ color: T.textTer }}>Supplement Stack</div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.supplements.map((s) => (
                      <span key={s} className="text-[10px] font-medium px-2.5 py-1 rounded-lg"
                        style={{ background: T.purpleDim, border: `1px solid ${PURPLE}20`, color: PURPLE }}>{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Deploy Button */}
              <button onClick={handleDeploy} disabled={!selectedGoal || phase === 'deploying'}
                className="w-full py-3.5 rounded-xl text-[13px] font-semibold tracking-wide uppercase transition-all duration-300"
                style={{
                  background: selectedGoal && phase !== 'deploying' ? `${NORTH_STAR_META[selectedGoal]?.color || CYAN}15` : 'rgba(255,255,255,0.03)',
                  border: `1.5px solid ${selectedGoal && phase !== 'deploying' ? (NORTH_STAR_META[selectedGoal]?.color || CYAN) + '40' : T.border}`,
                  color: selectedGoal && phase !== 'deploying' ? NORTH_STAR_META[selectedGoal]?.color || CYAN : 'rgba(255,255,255,0.2)',
                  cursor: selectedGoal && phase !== 'deploying' ? 'pointer' : 'not-allowed',
                }}>
                {phase === 'deploying' ? 'Deploying to BioVault...' : 'Deploy & Launch Protocol Engine'}
              </button>

              {error && <div className="text-[11px] text-center" style={{ color: T.red }}>{error}</div>}
            </motion.div>
          )}

          {/* ═══ PHASE: COMPLETE ═══ */}
          {phase === 'complete' && (
            <motion.div key="complete" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{ background: `radial-gradient(circle at 30% 30%, ${T.greenDim}, transparent)`, border: `2px solid ${GREEN}30`, boxShadow: `0 0 60px ${T.greenDim}` }}>
                <motion.svg width="36" height="36" viewBox="0 0 36 36">
                  <motion.path d="M8 18 L15 25 L28 11" stroke={GREEN} strokeWidth="3" fill="none" strokeLinecap="round"
                    initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.3, duration: 0.6 }} />
                </motion.svg>
              </motion.div>
              <h2 className="text-xl font-bold" style={{ color: T.text }}>BioVault Initialized</h2>
              <p className="text-xs leading-relaxed" style={{ color: T.textSec }}>
                {profile ? `${profile.dataQuality.analytesExtracted} biomarkers mapped` : 'Profile created'} · Protocol engine calibrating...
              </p>
              <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}
                className="text-[9px] font-mono tracking-wider" style={{ color: T.textTer }}>
                INITIALIZING COMMAND CENTER...
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
