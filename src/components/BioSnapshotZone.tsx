import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

/* ── Design Tokens ── */
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
  red: '#FF6B6B',
  border: 'rgba(255,255,255,0.06)',
  borderActive: 'rgba(0,240,255,0.25)',
};

type PerformanceGoal = 'cognitive' | 'physical' | 'longevity';
type Phase = 'idle' | 'uploading' | 'extracting' | 'review' | 'deploying' | 'complete';

interface ExtractedData {
  age: number | null;
  gender: string | null;
  weight: number | null;
  weightUnit: string | null;
  inferredGoal: PerformanceGoal | null;
  goalConfidence: number;
  goalReason: string;
  biomarkers: Record<string, number | null>;
  supplements: string[];
  dietaryRestrictions: string | null;
  preferredProteins: string | null;
  geneticFlags: { mthfrVariant: boolean; apoe4: boolean; caffeineSensitivity: boolean };
  sleepHours: number | null;
  dataQuality: 'high' | 'medium' | 'low';
  dataQualityNote: string;
  analytesExtracted: number;
}

const GOAL_META: Record<PerformanceGoal, { label: string; icon: string; accent: string; accentDim: string }> = {
  cognitive: { label: 'Cognitive Peak', icon: '🧠', accent: T.purple, accentDim: T.purpleDim },
  physical: { label: 'Physical Recovery', icon: '⚡', accent: T.cyan, accentDim: T.cyanDim },
  longevity: { label: 'Lifespan Extension', icon: '🧬', accent: T.green, accentDim: T.greenDim },
};

const SUPPLEMENT_MAP: Record<string, string> = {
  'omega-3 / fish oil': 'omega3', 'fish oil': 'omega3', 'omega-3': 'omega3', 'epa/dha': 'omega3',
  'vitamin d3 + k2': 'vitd', 'vitamin d3': 'vitd', 'vitamin d': 'vitd', 'd3+k2': 'vitd',
  'magnesium glycinate': 'magnesium', 'magnesium': 'magnesium', 'mag glycinate': 'magnesium',
  'creatine': 'creatine', 'creatine monohydrate': 'creatine',
  'whey protein': 'protein', 'plant protein': 'protein', 'whey / plant protein': 'protein',
  'caffeine': 'caffeine', 'pre-workout': 'caffeine',
  'ashwagandha': 'ashwagandha', 'ksm-66': 'ashwagandha',
  "lion's mane": 'lions-mane', 'lions mane': 'lions-mane',
  'zinc': 'zinc', 'b-complex': 'b-complex', 'b complex': 'b-complex',
  'collagen': 'collagen', 'probiotics': 'probiotics',
  'turmeric': 'turmeric', 'curcumin': 'turmeric', 'turmeric / curcumin': 'turmeric',
  'melatonin': 'melatonin', 'electrolytes': 'electrolytes',
};

function mapSupplementNames(names: string[]): string[] {
  const ids = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase().trim();
    const mapped = SUPPLEMENT_MAP[key];
    if (mapped) ids.add(mapped);
    else {
      for (const [pattern, id] of Object.entries(SUPPLEMENT_MAP)) {
        if (key.includes(pattern) || pattern.includes(key)) { ids.add(id); break; }
      }
    }
  }
  return Array.from(ids);
}

/* ── Scanning Animation ── */
function ScanAnimation({ phase }: { phase: Phase }) {
  if (phase !== 'extracting') return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', borderRadius: 20 }}
    >
      <motion.div
        animate={{ y: ['-100%', '200%'] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute', left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${T.cyan}, transparent)`,
          boxShadow: `0 0 30px 10px ${T.cyanDim}`,
        }}
      />
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: [0, 0.6, 0], x: [0, 200] }}
          transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }}
          style={{
            position: 'absolute', top: 30 + i * 40, left: 20,
            height: 1, width: 60 + Math.random() * 100, borderRadius: 1,
            background: `${T.cyan}40`,
          }}
        />
      ))}
    </motion.div>
  );
}

/* ── Biomarker Result Card ── */
function BiomarkerCard({ name, value, unit, status }: { name: string; value: number; unit: string; status: 'optimal' | 'warning' | 'critical' }) {
  const color = status === 'optimal' ? T.green : status === 'warning' ? T.orange : T.red;
  const bg = status === 'optimal' ? T.greenDim : status === 'warning' ? T.orangeDim : 'rgba(255,107,107,0.12)';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        padding: '8px 10px', borderRadius: 10,
        background: bg, border: `1px solid ${color}25`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}
    >
      <span style={{ fontSize: 10, color: T.textSec, fontFamily: 'monospace' }}>{name}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
        <span style={{ fontSize: 8, color: T.textTer }}>{unit}</span>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   BIO-SNAPSHOT ZONE — Zero-Form Upload Component
   ══════════════════════════════════════════════════════════════ */
export default function BioSnapshotZone({ sessionId, onComplete }: {
  sessionId: string;
  onComplete: (data: { goal: PerformanceGoal; supplements: string[] }) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [dragOver, setDragOver] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<PerformanceGoal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const extractBioSnapshot = useAction(api.ai.extractBioSnapshot);
  const upsertBioVault = useMutation(api.mutations.upsertBioVault);
  const upsertUserVitals = useMutation(api.mutations.upsertUserVitals);

  const processText = useCallback(async (text: string, name: string, inputType: string) => {
    setPhase('extracting');
    setFileName(name);
    setError(null);
    try {
      const result = await extractBioSnapshot({ rawText: text, inputType });
      if (!result.success || !result.data) {
        setError(result.error || 'Extraction failed');
        setPhase('idle');
        return;
      }
      const data = result.data as ExtractedData;
      setExtractedData(data);
      setSelectedGoal(data.inferredGoal);
      setPhase('review');
    } catch (err: any) {
      setError(err?.message || 'Extraction failed');
      setPhase('idle');
    }
  }, [extractBioSnapshot]);

  const handleFile = useCallback(async (file: File) => {
    setPhase('uploading');
    setError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const inputType = file.type.includes('image') ? 'supplement_photo' : 'lab_report';
      await processText(text, file.name, inputType);
    } catch {
      setError('Could not read file. Try pasting the text instead.');
      setPhase('idle');
    }
  }, [processText]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handlePaste = useCallback((text: string) => {
    if (text.trim().length < 10) return;
    processText(text, 'Pasted text', 'free_text');
  }, [processText]);

  const handleDeploy = useCallback(async () => {
    if (!extractedData || !selectedGoal) return;
    setPhase('deploying');
    try {
      const bm = extractedData.biomarkers;
      await upsertBioVault({
        sessionId,
        vitaminD: bm.vitaminD ?? undefined,
        testosteroneFree: bm.testosteroneFree ?? undefined,
        testosteroneTotal: bm.testosteroneTotal ?? undefined,
        ferritin: bm.ferritin ?? undefined,
        crp: bm.crp ?? undefined,
        hba1c: bm.hba1c ?? undefined,
        mthfrVariant: extractedData.geneticFlags?.mthfrVariant ?? false,
        apoe4: extractedData.geneticFlags?.apoe4 ?? false,
        caffeineSensitivity: extractedData.geneticFlags?.caffeineSensitivity ?? false,
        preferredProteins: extractedData.preferredProteins || 'chicken, fish, eggs',
        dietaryRestrictions: extractedData.dietaryRestrictions || 'none',
      });

      if (extractedData.age || extractedData.weight) {
        await upsertUserVitals({
          sessionId,
          age: extractedData.age || 30,
          gender: extractedData.gender || 'male',
          weight: extractedData.weight || 170,
          unit: extractedData.weightUnit || 'lbs',
        });
      }

      setPhase('complete');
      const mappedSupps = mapSupplementNames(extractedData.supplements || []);
      setTimeout(() => {
        onComplete({ goal: selectedGoal, supplements: mappedSupps });
      }, 1800);
    } catch (err: any) {
      setError(err?.message || 'Failed to save data');
      setPhase('review');
    }
  }, [extractedData, selectedGoal, sessionId, upsertBioVault, upsertUserVitals, onComplete]);

  const biomarkerEntries = extractedData?.biomarkers
    ? Object.entries(extractedData.biomarkers).filter(([, v]) => v !== null && typeof v === 'number')
    : [];

  const ELITE_RANGES: Record<string, { min?: number; max?: number; unit: string; label: string }> = {
    vitaminD: { min: 40, max: 60, unit: 'ng/mL', label: 'Vitamin D' },
    ferritin: { min: 40, max: 150, unit: 'ng/mL', label: 'Ferritin' },
    crp: { max: 0.5, unit: 'mg/L', label: 'hs-CRP' },
    hba1c: { max: 5.4, unit: '%', label: 'HbA1c' },
    testosteroneTotal: { min: 600, max: 900, unit: 'ng/dL', label: 'Testosterone' },
    testosteroneFree: { min: 15, max: 25, unit: 'pg/mL', label: 'Free T' },
    glucose: { min: 75, max: 90, unit: 'mg/dL', label: 'Glucose' },
    hdl: { min: 55, unit: 'mg/dL', label: 'HDL' },
    ldl: { max: 100, unit: 'mg/dL', label: 'LDL' },
    triglycerides: { max: 80, unit: 'mg/dL', label: 'Triglycerides' },
    b12: { min: 500, max: 1000, unit: 'pg/mL', label: 'B12' },
    iron: { min: 80, max: 120, unit: 'mcg/dL', label: 'Iron' },
    hemoglobin: { min: 14, max: 17, unit: 'g/dL', label: 'Hemoglobin' },
    omega3Index: { min: 8, unit: '%', label: 'Omega-3 Idx' },
    homocysteine: { max: 8, unit: 'umol/L', label: 'Homocysteine' },
    tsh: { min: 1.0, max: 2.5, unit: 'mIU/L', label: 'TSH' },
    magnesium: { min: 5.0, max: 6.5, unit: 'mg/dL', label: 'Magnesium' },
    zinc: { min: 90, max: 120, unit: 'mcg/dL', label: 'Zinc' },
    insulin: { min: 2, max: 5, unit: 'uIU/mL', label: 'Insulin' },
    cortisol: { min: 10, max: 16, unit: 'mcg/dL', label: 'Cortisol' },
    folate: { min: 10, max: 25, unit: 'ng/mL', label: 'Folate' },
    freeT4: { min: 1.2, max: 1.5, unit: 'ng/dL', label: 'Free T4' },
    igf1: { min: 100, max: 250, unit: 'ng/mL', label: 'IGF-1' },
    fastingGlucose: { min: 75, max: 90, unit: 'mg/dL', label: 'Fasting Glucose' },
  };

  function getStatus(key: string, val: number): 'optimal' | 'warning' | 'critical' {
    const r = ELITE_RANGES[key];
    if (!r) return 'optimal';
    if (r.min !== undefined && r.max !== undefined) {
      if (val < r.min * 0.75 || val > r.max * 1.25) return 'critical';
      if (val < r.min || val > r.max) return 'warning';
    } else if (r.max !== undefined) {
      if (val > r.max * 1.5) return 'critical';
      if (val > r.max) return 'warning';
    } else if (r.min !== undefined) {
      if (val < r.min * 0.75) return 'critical';
      if (val < r.min) return 'warning';
    }
    return 'optimal';
  }

  /* ── IDLE: Upload Zone ── */
  if (phase === 'idle' || phase === 'uploading') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        <div style={{ textAlign: 'center' }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{
              width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px',
              background: T.cyanGlow, border: `1px solid ${T.borderActive}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 60px ${T.cyanGlow}`,
            }}
          >
            <span style={{ fontSize: 28 }}>🧬</span>
          </motion.div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.cyan, boxShadow: `0 0 8px ${T.cyanDim}` }} />
            <span style={{ fontSize: 9, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.2em', color: `${T.cyan}80` }}>
              Zero-Form Initialization
            </span>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: T.cyan, boxShadow: `0 0 8px ${T.cyanDim}` }} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: T.text, margin: 0, letterSpacing: '-0.02em' }}>
            Bio-Snapshot Upload
          </h1>
          <p style={{ fontSize: 12, color: T.textTer, marginTop: 8, lineHeight: 1.7, maxWidth: 360, margin: '8px auto 0' }}>
            Drop a lab report, supplement photo, or paste health data. The AI Brain extracts everything — no forms required.
          </p>
        </div>

        {/* Drop Zone */}
        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          animate={{
            borderColor: dragOver ? T.cyan : 'rgba(255,255,255,0.08)',
            background: dragOver ? T.cyanGlow : 'rgba(255,255,255,0.015)',
          }}
          whileHover={{ borderColor: `${T.cyan}40` }}
          style={{
            position: 'relative', padding: '40px 24px', borderRadius: 20, cursor: 'pointer',
            border: '2px dashed rgba(255,255,255,0.08)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            transition: 'all 0.3s',
            overflow: 'hidden',
          }}
        >
          {phase === 'uploading' ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <circle cx="18" cy="18" r="15" stroke={`${T.cyan}20`} strokeWidth="2" />
                <path d="M18 3 A15 15 0 0 1 33 18" stroke={T.cyan} strokeWidth="2" strokeLinecap="round" />
              </svg>
            </motion.div>
          ) : (
            <>
              <div style={{
                width: 52, height: 52, borderRadius: 16,
                background: T.cyanGlow, border: `1px solid ${T.borderActive}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={T.cyan} strokeWidth="1.5" strokeLinecap="round">
                  <path d="M12 16V4M12 4L8 8M12 4L16 8" />
                  <path d="M4 17V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V17" />
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                  Drop lab report or supplement photo
                </div>
                <div style={{ fontSize: 10, color: T.textTer }}>
                  PDF, TXT, CSV, or image — or click to browse
                </div>
              </div>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.csv,.png,.jpg,.jpeg"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />

          {/* Corner accents */}
          {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
            <div key={pos} style={{
              position: 'absolute',
              top: pos.includes('top') ? 8 : undefined,
              bottom: pos.includes('bottom') ? 8 : undefined,
              left: pos.includes('left') ? 8 : undefined,
              right: pos.includes('right') ? 8 : undefined,
              width: 12, height: 12,
              borderTop: pos.includes('top') ? `1px solid ${T.cyan}30` : undefined,
              borderBottom: pos.includes('bottom') ? `1px solid ${T.cyan}30` : undefined,
              borderLeft: pos.includes('left') ? `1px solid ${T.cyan}30` : undefined,
              borderRight: pos.includes('right') ? `1px solid ${T.cyan}30` : undefined,
            }} />
          ))}
        </motion.div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: T.border }} />
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.1em' }}>OR PASTE TEXT</span>
          <div style={{ flex: 1, height: 1, background: T.border }} />
        </div>

        {/* Paste Area */}
        <textarea
          placeholder="Paste lab results, supplement list, or describe your current health status..."
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handlePaste((e.target as HTMLTextAreaElement).value);
            }
          }}
          onBlur={(e) => {
            if (e.target.value.trim().length > 20) handlePaste(e.target.value);
          }}
          style={{
            width: '100%', minHeight: 80, padding: '12px 14px', borderRadius: 14,
            background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}`,
            color: T.text, fontSize: 12, fontFamily: 'monospace', resize: 'vertical',
            outline: 'none', lineHeight: 1.6,
          }}
        />

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)',
            fontSize: 11, color: T.red,
          }}>
            {error}
          </motion.div>
        )}

        <div style={{ fontSize: 9, color: T.textTer, textAlign: 'center', fontFamily: 'monospace', lineHeight: 1.6 }}>
          ⌘+Enter to submit pasted text · Your data is processed securely and never shared
        </div>
      </motion.div>
    );
  }

  /* ── EXTRACTING: Scan Animation ── */
  if (phase === 'extracting') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{
          width: '100%', maxWidth: 460, position: 'relative',
          padding: '60px 24px', borderRadius: 20,
          background: T.surface, border: `1px solid ${T.borderActive}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
          overflow: 'hidden',
        }}
      >
        <ScanAnimation phase={phase} />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            border: `2px solid ${T.cyanDim}`, borderTopColor: T.cyan,
          }}
        />
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.cyan, marginBottom: 6 }}>
            AI Brain Analyzing
          </div>
          <div style={{ fontSize: 11, color: T.textSec }}>{fileName}</div>
          <motion.div
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, marginTop: 12, letterSpacing: '0.1em' }}
          >
            EXTRACTING BIOMARKERS · MAPPING SUPPLEMENTS · INFERRING GOALS
          </motion.div>
        </div>
      </motion.div>
    );
  }

  /* ── REVIEW: Extracted Data ── */
  if ((phase === 'review' || phase === 'deploying') && extractedData) {
    const goalData = selectedGoal ? GOAL_META[selectedGoal] : null;
    const optimalCount = biomarkerEntries.filter(([k, v]) => getStatus(k, v as number) === 'optimal').length;
    const warningCount = biomarkerEntries.filter(([k, v]) => getStatus(k, v as number) === 'warning').length;
    const criticalCount = biomarkerEntries.filter(([k, v]) => getStatus(k, v as number) === 'critical').length;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
            style={{
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
              background: T.greenDim, border: `1px solid rgba(0,255,204,0.3)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 40px ${T.greenDim}`,
            }}
          >
            <span style={{ fontSize: 24 }}>✓</span>
          </motion.div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: 0 }}>
            Snapshot Extracted
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
            <span style={{
              fontSize: 9, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 6,
              background: extractedData.dataQuality === 'high' ? T.greenDim : extractedData.dataQuality === 'medium' ? T.orangeDim : 'rgba(255,107,107,0.1)',
              color: extractedData.dataQuality === 'high' ? T.green : extractedData.dataQuality === 'medium' ? T.orange : T.red,
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              {extractedData.dataQuality} quality
            </span>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer }}>
              {extractedData.analytesExtracted} analytes · {extractedData.supplements?.length || 0} supplements
            </span>
          </div>
        </div>

        {/* Goal Selection */}
        <div style={{
          padding: 14, borderRadius: 16,
          background: T.surface, border: `1px solid ${T.border}`,
        }}>
          <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.12em', marginBottom: 10, textTransform: 'uppercase' }}>
            AI-Inferred Goal {extractedData.goalConfidence > 0 && `· ${Math.round(extractedData.goalConfidence * 100)}% confidence`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(Object.keys(GOAL_META) as PerformanceGoal[]).map((g) => {
              const meta = GOAL_META[g];
              const isSelected = selectedGoal === g;
              return (
                <motion.button
                  key={g}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedGoal(g)}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 12, cursor: 'pointer',
                    background: isSelected ? meta.accentDim : 'rgba(255,255,255,0.02)',
                    border: `1.5px solid ${isSelected ? meta.accent + '40' : T.border}`,
                    textAlign: 'center', transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{meta.icon}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: isSelected ? meta.accent : T.textSec }}>
                    {meta.label}
                  </div>
                </motion.button>
              );
            })}
          </div>
          {extractedData.goalReason && (
            <div style={{ fontSize: 10, color: T.textTer, marginTop: 8, lineHeight: 1.5, fontStyle: 'italic' }}>
              {extractedData.goalReason}
            </div>
          )}
        </div>

        {/* Biomarker Grid */}
        {biomarkerEntries.length > 0 && (
          <div style={{
            padding: 14, borderRadius: 16,
            background: T.surface, border: `1px solid ${T.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Biomarkers Detected
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {optimalCount > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.green }}>✓{optimalCount}</span>}
                {warningCount > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.orange }}>⚠{warningCount}</span>}
                {criticalCount > 0 && <span style={{ fontSize: 9, fontFamily: 'monospace', color: T.red }}>✕{criticalCount}</span>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
              {biomarkerEntries.map(([key, val]) => {
                const range = ELITE_RANGES[key];
                return (
                  <BiomarkerCard
                    key={key}
                    name={range?.label || key}
                    value={val as number}
                    unit={range?.unit || ''}
                    status={getStatus(key, val as number)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Supplements */}
        {extractedData.supplements && extractedData.supplements.length > 0 && (
          <div style={{
            padding: 14, borderRadius: 16,
            background: T.surface, border: `1px solid ${T.border}`,
          }}>
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.12em', marginBottom: 8, textTransform: 'uppercase' }}>
              Supplement Stack Detected
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {extractedData.supplements.map((s) => (
                <span key={s} style={{
                  fontSize: 10, padding: '5px 10px', borderRadius: 8,
                  background: T.purpleDim, border: `1px solid ${T.purple}20`,
                  color: T.purple, fontWeight: 500,
                }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Deploy Button */}
        <button
          onClick={handleDeploy}
          disabled={!selectedGoal || phase === 'deploying'}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 14,
            fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
            background: selectedGoal && phase !== 'deploying' ? `${goalData?.accent || T.cyan}15` : 'rgba(255,255,255,0.03)',
            border: `1.5px solid ${selectedGoal && phase !== 'deploying' ? (goalData?.accent || T.cyan) + '40' : T.border}`,
            color: selectedGoal && phase !== 'deploying' ? goalData?.accent || T.cyan : 'rgba(255,255,255,0.2)',
            cursor: selectedGoal && phase !== 'deploying' ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s',
          }}
        >
          {phase === 'deploying' ? 'Deploying to BioVault...' : 'Deploy Snapshot & Continue'}
        </button>

        {error && (
          <div style={{ fontSize: 11, color: T.red, textAlign: 'center' }}>{error}</div>
        )}
      </motion.div>
    );
  }

  /* ── COMPLETE ── */
  if (phase === 'complete') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ width: '100%', maxWidth: 400, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          style={{
            width: 80, height: 80, borderRadius: 24,
            background: `radial-gradient(circle at 30% 30%, ${T.greenDim}, transparent)`,
            border: `2px solid ${T.green}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 60px ${T.greenDim}`,
          }}
        >
          <motion.svg width="36" height="36" viewBox="0 0 36 36">
            <motion.path
              d="M8 18 L15 25 L28 11"
              stroke={T.green}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            />
          </motion.svg>
        </motion.div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: 0 }}>
          BioVault Initialized
        </h2>
        <p style={{ fontSize: 12, color: T.textSec, lineHeight: 1.6 }}>
          {extractedData?.analytesExtracted || 0} biomarkers mapped · Profile calibrated · Protocols loading...
        </p>
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ fontSize: 9, fontFamily: 'monospace', color: T.textTer, letterSpacing: '0.15em' }}
        >
          INITIALIZING COMMAND CENTER...
        </motion.div>
      </motion.div>
    );
  }

  return null;
}
