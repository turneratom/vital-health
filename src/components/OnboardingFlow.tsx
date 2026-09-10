import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

/* ══════════════════════════════════════════════════════════════
   ONBOARDING FLOW — 4-Step Clinical-Luxury Bio-Initialization
   
   Step 1: The Bio-Scanner (age, weight, longevity goal)
   Step 2: External Sync (Apple Health / Oura bridge)
   Step 3: Protocol Selection (Peptides, TRT, Vitamin IVs, Holistic)
   Step 4: Initial Assessment (AI Vitality Score reveal)
   
   Dark-mode clinical-luxury: glowing progress, smooth transitions,
   feels like initializing a high-performance machine.
   ══════════════════════════════════════════════════════════════ */

const P = {
  bg: '#050508',
  surface: 'rgba(10,10,16,0.92)',
  card: 'rgba(14,14,22,0.88)',
  text: '#EEEEF2',
  textSec: 'rgba(255,255,255,0.52)',
  textTer: 'rgba(255,255,255,0.24)',
  cyan: '#00E8FF',
  cyanDim: 'rgba(0,232,255,0.10)',
  cyanGlow: 'rgba(0,232,255,0.05)',
  emerald: '#00FFCC',
  emeraldDim: 'rgba(0,255,204,0.10)',
  violet: '#A78BFA',
  violetDim: 'rgba(167,139,250,0.10)',
  amber: '#FBBF24',
  amberDim: 'rgba(251,191,36,0.10)',
  border: 'rgba(255,255,255,0.05)',
  borderActive: 'rgba(0,232,255,0.20)',
};

const STEPS = [
  { id: 'scanner', label: 'BIO-SCANNER', icon: '🧬', accent: P.cyan, dim: P.cyanDim },
  { id: 'sync', label: 'EXTERNAL SYNC', icon: '📡', accent: P.emerald, dim: P.emeraldDim },
  { id: 'protocols', label: 'PROTOCOLS', icon: '⚗️', accent: P.violet, dim: P.violetDim },
  { id: 'reveal', label: 'BIO-REVEAL', icon: '✨', accent: P.amber, dim: P.amberDim },
];

const GOALS = [
  { id: 'age-reversal', label: 'Biological Age Reversal', icon: '🧬', desc: 'Turn back your biological clock through targeted interventions' },
  { id: 'peak-output', label: 'Peak Cognitive Output', icon: '🧠', desc: 'Maximize mental clarity, focus, and sustained energy' },
  { id: 'body-recomp', label: 'Body Recomposition', icon: '💪', desc: 'Optimize muscle-to-fat ratio and metabolic efficiency' },
  { id: 'longevity', label: 'Healthspan Extension', icon: '♾️', desc: 'Maximize years of high-quality, disease-free living' },
  { id: 'recovery', label: 'Recovery Optimization', icon: '🔋', desc: 'Accelerate recovery and reduce chronic inflammation' },
];

const SYNC_SOURCES = [
  { id: 'apple-health', label: 'Apple Health', icon: '🍎', desc: 'HRV, Sleep, Activity, Heart Rate', color: '#FF375F' },
  { id: 'oura', label: 'Oura Ring', icon: '💍', desc: 'Sleep stages, Readiness, Temperature', color: '#D4AF37' },
  { id: 'whoop', label: 'WHOOP', icon: '⌚', desc: 'Strain, Recovery, Sleep Performance', color: '#00DC82' },
  { id: 'garmin', label: 'Garmin', icon: '🏃', desc: 'VO2 Max, Training Load, Body Battery', color: '#007CC3' },
];

const PROTOCOL_OPTIONS = [
  { id: 'peptides', label: 'Peptides', icon: '💉', desc: 'BPC-157, TB-500, GHK-Cu, Thymosin Alpha-1', accent: P.cyan },
  { id: 'trt', label: 'TRT / HRT', icon: '⚡', desc: 'Testosterone, Estrogen, DHEA optimization', accent: P.emerald },
  { id: 'vitamin-iv', label: 'Vitamin IVs', icon: '💧', desc: 'NAD+, Glutathione, Myers Cocktail, High-dose C', accent: P.violet },
  { id: 'holistic', label: 'Holistic Only', icon: '🌿', desc: 'Supplements, nutrition, sleep, breathwork, cold exposure', accent: P.amber },
];

/* ── Glow Progress Bar ── */
function GlowProgress({ step }: { step: number }) {
  const pct = ((step + 1) / STEPS.length) * 100;
  const accent = STEPS[step]?.accent || P.cyan;
  return (
    <div style={{ width: '100%', maxWidth: 480, margin: '0 auto', padding: '0 20px' }}>
      {/* Step dots */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <motion.div
              animate={{
                scale: i === step ? [1, 1.3, 1] : 1,
                background: i <= step ? s.accent : 'rgba(255,255,255,0.08)',
                boxShadow: i === step ? `0 0 12px ${s.accent}80, 0 0 24px ${s.accent}30` : i < step ? `0 0 6px ${s.accent}40` : 'none',
              }}
              transition={{ duration: i === step ? 1.5 : 0.4, repeat: i === step ? Infinity : 0, repeatType: 'reverse' }}
              style={{ width: 7, height: 7, borderRadius: '50%' }}
            />
            <span style={{
              fontSize: 8, fontFamily: 'monospace', letterSpacing: '0.12em', fontWeight: 600,
              color: i === step ? s.accent : i < step ? s.accent + '80' : P.textTer,
              transition: 'color 0.4s',
            }}>
              {i === step ? s.label : ''}
            </span>
          </div>
        ))}
      </div>
      {/* Bar */}
      <div style={{
        height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.03)',
        overflow: 'hidden', position: 'relative',
      }}>
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
          style={{
            height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${accent}50, ${accent})`,
            boxShadow: `0 0 16px ${accent}50, 0 0 40px ${accent}18`,
          }}
        />
        {/* Shimmer */}
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', top: 0, left: 0, width: '30%', height: '100%',
            background: `linear-gradient(90deg, transparent, ${accent}30, transparent)`,
          }}
        />
      </div>
    </div>
  );
}

/* ── Shared Button ── */
function ActionBtn({ enabled, onClick, label, accent, loading }: {
  enabled: boolean; onClick: () => void; label: string; accent?: string; loading?: boolean;
}) {
  const c = accent || P.cyan;
  return (
    <motion.button
      whileTap={enabled && !loading ? { scale: 0.97 } : {}}
      whileHover={enabled && !loading ? { scale: 1.01 } : {}}
      onClick={enabled && !loading ? onClick : undefined}
      style={{
        width: '100%', padding: '15px 24px', borderRadius: 14, cursor: enabled && !loading ? 'pointer' : 'not-allowed',
        background: enabled ? `linear-gradient(135deg, ${c}18, ${c}06)` : 'rgba(255,255,255,0.02)',
        border: `1.5px solid ${enabled ? c + '40' : 'rgba(255,255,255,0.05)'}`,
        boxShadow: enabled ? `0 0 30px ${c}12, inset 0 1px 0 rgba(255,255,255,0.03)` : 'none',
        color: enabled ? c : P.textTer,
        fontSize: 13, fontWeight: 600, letterSpacing: '0.03em',
        fontFamily: 'inherit', transition: 'all 0.3s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      {loading && <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⟳</motion.span>}
      {label}
    </motion.button>
  );
}

/* ── Step Header ── */
function StepHead({ step, title, sub }: { step: number; title: string; sub: string }) {
  const s = STEPS[step];
  return (
    <div style={{ textAlign: 'center', marginBottom: 28 }}>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px',
          background: s.dim, border: `1px solid ${s.accent}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, boxShadow: `0 0 40px ${s.accent}15`,
        }}
      >
        {s.icon}
      </motion.div>
      <motion.h2
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{ fontSize: 22, fontWeight: 700, color: P.text, margin: '0 0 6px', letterSpacing: '-0.02em' }}
      >
        {title}
      </motion.h2>
      <motion.p
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{ fontSize: 13, color: P.textSec, margin: 0, lineHeight: 1.5 }}
      >
        {sub}
      </motion.p>
    </div>
  );
}

/* ── Selection Card ── */
function SelectCard({ selected, onClick, icon, label, desc, accent }: {
  selected: boolean; onClick: () => void; icon: string; label: string; desc: string; accent: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        width: '100%', padding: '14px 16px', borderRadius: 14, cursor: 'pointer',
        background: selected ? `${accent}0A` : 'rgba(255,255,255,0.015)',
        border: `1.5px solid ${selected ? accent + '40' : P.border}`,
        boxShadow: selected ? `0 0 24px ${accent}12, inset 0 1px 0 rgba(255,255,255,0.02)` : 'none',
        display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
        fontFamily: 'inherit', transition: 'all 0.3s',
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: selected ? `${accent}15` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${selected ? accent + '30' : 'transparent'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        transition: 'all 0.3s',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: selected ? accent : P.text, transition: 'color 0.3s' }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: P.textSec, marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
      </div>
      <motion.div
        animate={{ scale: selected ? 1 : 0.6, opacity: selected ? 1 : 0.2 }}
        style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          background: selected ? accent : 'transparent',
          border: `2px solid ${selected ? accent : 'rgba(255,255,255,0.12)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: '#000', fontWeight: 700,
        }}
      >
        {selected ? '✓' : ''}
      </motion.div>
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 1: THE BIO-SCANNER
   ═══════════════════════════════════════════════════════════════ */
function BioScannerStep({ data, onChange, onNext }: {
  data: { age: string; weight: string; unit: string; goal: string };
  onChange: (d: any) => void;
  onNext: () => void;
}) {
  const valid = data.age && data.weight && data.goal && Number(data.age) > 0 && Number(data.weight) > 0;
  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.4 }}>
      <StepHead step={0} title="The Bio-Scanner" sub="Initialize your biological profile. This data calibrates your Digital Twin." />
      
      {/* Age + Weight row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, fontFamily: 'monospace', color: P.textTer, letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>AGE</label>
          <input
            type="number"
            value={data.age}
            onChange={e => onChange({ ...data, age: e.target.value })}
            placeholder="32"
            style={{
              width: '100%', padding: '13px 14px', borderRadius: 12, fontSize: 15, fontWeight: 600,
              background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${data.age ? P.borderActive : P.border}`,
              color: P.text, fontFamily: 'inherit', outline: 'none', transition: 'border 0.3s',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 9, fontFamily: 'monospace', color: P.textTer, letterSpacing: '0.12em', display: 'block', marginBottom: 6 }}>WEIGHT</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="number"
              value={data.weight}
              onChange={e => onChange({ ...data, weight: e.target.value })}
              placeholder="175"
              style={{
                flex: 1, padding: '13px 14px', borderRadius: 12, fontSize: 15, fontWeight: 600,
                background: 'rgba(255,255,255,0.03)', border: `1.5px solid ${data.weight ? P.borderActive : P.border}`,
                color: P.text, fontFamily: 'inherit', outline: 'none', transition: 'border 0.3s',
                boxSizing: 'border-box', minWidth: 0,
              }}
            />
            <button
              onClick={() => onChange({ ...data, unit: data.unit === 'lbs' ? 'kg' : 'lbs' })}
              style={{
                padding: '0 14px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                background: P.cyanDim, border: `1px solid ${P.cyan}25`, color: P.cyan,
                cursor: 'pointer', fontFamily: 'monospace', letterSpacing: '0.05em', whiteSpace: 'nowrap',
              }}
            >
              {data.unit}
            </button>
          </div>
        </div>
      </div>

      {/* Goal Selection */}
      <label style={{ fontSize: 9, fontFamily: 'monospace', color: P.textTer, letterSpacing: '0.12em', display: 'block', marginBottom: 10 }}>PRIMARY LONGEVITY GOAL</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {GOALS.map(g => (
          <SelectCard
            key={g.id}
            selected={data.goal === g.id}
            onClick={() => onChange({ ...data, goal: g.id })}
            icon={g.icon}
            label={g.label}
            desc={g.desc}
            accent={P.cyan}
          />
        ))}
      </div>

      <ActionBtn enabled={!!valid} onClick={onNext} label="Initialize Bio-Scanner →" accent={P.cyan} />
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 2: EXTERNAL SYNC
   ═══════════════════════════════════════════════════════════════ */
function ExternalSyncStep({ synced, onToggle, onNext, onBack }: {
  synced: Set<string>; onToggle: (id: string) => void; onNext: () => void; onBack: () => void;
}) {
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = useCallback((id: string) => {
    setConnecting(id);
    setTimeout(() => {
      onToggle(id);
      setConnecting(null);
    }, 1200);
  }, [onToggle]);

  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.4 }}>
      <StepHead step={1} title="External Sync" sub="Bridge your wearable data for real-time biological monitoring." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {SYNC_SOURCES.map(src => {
          const active = synced.has(src.id);
          const isConnecting = connecting === src.id;
          return (
            <motion.button
              key={src.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => !active && !isConnecting && handleConnect(src.id)}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 14, cursor: active ? 'default' : 'pointer',
                background: active ? `${src.color}0A` : 'rgba(255,255,255,0.015)',
                border: `1.5px solid ${active ? src.color + '35' : P.border}`,
                boxShadow: active ? `0 0 20px ${src.color}10` : 'none',
                display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                fontFamily: 'inherit', transition: 'all 0.3s',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: active ? `${src.color}18` : 'rgba(255,255,255,0.03)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                border: `1px solid ${active ? src.color + '25' : 'transparent'}`,
              }}>
                {src.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: active ? src.color : P.text }}>{src.label}</div>
                <div style={{ fontSize: 11, color: P.textSec, marginTop: 2 }}>{src.desc}</div>
              </div>
              <div style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                fontFamily: 'monospace', letterSpacing: '0.08em',
                background: active ? `${src.color}20` : isConnecting ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.03)',
                color: active ? src.color : isConnecting ? P.textSec : P.textTer,
                border: `1px solid ${active ? src.color + '30' : 'rgba(255,255,255,0.06)'}`,
              }}>
                {active ? '✓ LINKED' : isConnecting ? '...' : 'CONNECT'}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Upload option */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{
          padding: '14px 16px', borderRadius: 14, marginBottom: 24,
          background: 'rgba(255,255,255,0.015)', border: `1px dashed ${P.border}`,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 11, color: P.textSec, marginBottom: 4 }}>
          📄 Have lab results? Upload DNA/Blood reports in the BioVault later.
        </div>
        <div style={{ fontSize: 9, color: P.textTer, fontFamily: 'monospace' }}>
          Quest • Labcorp • 23andMe • InsideTracker
        </div>
      </motion.div>

      <div style={{ display: 'flex', gap: 10 }}>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          style={{
            padding: '15px 20px', borderRadius: 14, cursor: 'pointer',
            background: 'rgba(255,255,255,0.02)', border: `1px solid ${P.border}`,
            color: P.textSec, fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
          }}
        >
          ←
        </motion.button>
        <div style={{ flex: 1 }}>
          <ActionBtn enabled onClick={onNext} label={synced.size > 0 ? `Continue with ${synced.size} source${synced.size > 1 ? 's' : ''} →` : 'Skip for now →'} accent={P.emerald} />
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 3: PROTOCOL SELECTION
   ═══════════════════════════════════════════════════════════════ */
function ProtocolStep({ selected, onToggle, onNext, onBack }: {
  selected: Set<string>; onToggle: (id: string) => void; onNext: () => void; onBack: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.4 }}>
      <StepHead step={2} title="Protocol Selection" sub="Select the interventions in your current stack. This calibrates your protocol engine." />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {PROTOCOL_OPTIONS.map(p => (
          <SelectCard
            key={p.id}
            selected={selected.has(p.id)}
            onClick={() => onToggle(p.id)}
            icon={p.icon}
            label={p.label}
            desc={p.desc}
            accent={p.accent}
          />
        ))}
      </div>

      <div style={{
        padding: '10px 14px', borderRadius: 10, marginBottom: 20,
        background: 'rgba(167,139,250,0.04)', border: `1px solid rgba(167,139,250,0.12)`,
      }}>
        <div style={{ fontSize: 10, color: P.violet, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
          ℹ️ Select all that apply. Your OS adapts to your intervention stack.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onBack}
          style={{
            padding: '15px 20px', borderRadius: 14, cursor: 'pointer',
            background: 'rgba(255,255,255,0.02)', border: `1px solid ${P.border}`,
            color: P.textSec, fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
          }}
        >
          ←
        </motion.button>
        <div style={{ flex: 1 }}>
          <ActionBtn enabled={selected.size > 0} onClick={onNext} label="Generate Vitality Score →" accent={P.violet} />
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STEP 4: THE BIO-REVEAL — AI Vitality Score
   ═══════════════════════════════════════════════════════════════ */
function BioRevealStep({ score, loading, breakdown, onComplete }: {
  score: number; loading: boolean; breakdown: { label: string; value: number; icon: string }[];
  onComplete: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Animate score count-up
  useEffect(() => {
    if (!loading && score > 0) {
      const timer = setTimeout(() => setRevealed(true), 400);
      return () => clearTimeout(timer);
    }
  }, [loading, score]);

  useEffect(() => {
    if (!revealed) return;
    let frame = 0;
    const total = 60;
    const step = score / total;
    const id = setInterval(() => {
      frame++;
      setDisplayScore(Math.min(Math.round(step * frame), score));
      if (frame >= total) clearInterval(id);
    }, 25);
    return () => clearInterval(id);
  }, [revealed, score]);

  // Particle canvas
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;
    cvs.width = cvs.offsetWidth * 2;
    cvs.height = cvs.offsetHeight * 2;
    ctx.scale(2, 2);
    const w = cvs.offsetWidth, h = cvs.offsetHeight;

    const particles: { x: number; y: number; vx: number; vy: number; r: number; a: number; color: string }[] = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: w / 2 + (Math.random() - 0.5) * 120,
        y: h / 2 + (Math.random() - 0.5) * 120,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 0.5,
        a: Math.random() * 0.5 + 0.2,
        color: [P.amber, P.cyan, P.emerald, P.violet][Math.floor(Math.random() * 4)],
      });
    }

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + Math.round(p.a * 255).toString(16).padStart(2, '0');
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const scoreColor = score >= 75 ? P.emerald : score >= 55 ? P.amber : '#FF6B6B';

  return (
    <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.4 }}>
      <StepHead step={3} title="Initial Assessment" sub={loading ? 'Analyzing your biological inputs...' : 'Your starting Vitality Score has been calculated.'} />

      {/* Score Ring */}
      <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto 24px' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        
        {/* SVG Ring */}
        <svg viewBox="0 0 200 200" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
          {revealed && (
            <motion.circle
              cx="100" cy="100" r="85"
              fill="none"
              stroke={scoreColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 85}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 85 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 85 * (1 - score / 100) }}
              transition={{ duration: 2, ease: [0.4, 0, 0.2, 1] }}
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: '100px 100px',
                filter: `drop-shadow(0 0 8px ${scoreColor}60)`,
              }}
            />
          )}
        </svg>

        {/* Score number */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          {loading ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{ fontSize: 28, color: P.amber }}
            >
              ⟳
            </motion.div>
          ) : (
            <>
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
                style={{
                  fontSize: 48, fontWeight: 800, color: scoreColor,
                  textShadow: `0 0 30px ${scoreColor}40`,
                  letterSpacing: '-0.04em', lineHeight: 1,
                }}
              >
                {displayScore}
              </motion.div>
              <div style={{ fontSize: 9, fontFamily: 'monospace', color: P.textTer, letterSpacing: '0.15em', marginTop: 4 }}>
                VITALITY SCORE
              </div>
            </>
          )}
        </div>
      </div>

      {/* Breakdown */}
      {!loading && revealed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          style={{ marginBottom: 24 }}
        >
          <div style={{
            fontSize: 9, fontFamily: 'monospace', color: P.textTer, letterSpacing: '0.12em',
            textAlign: 'center', marginBottom: 12,
          }}>
            SYSTEM BASELINE ANALYSIS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {breakdown.map((b, i) => (
              <motion.div
                key={b.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.4 + i * 0.15 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.015)', border: `1px solid ${P.border}`,
                }}
              >
                <span style={{ fontSize: 18 }}>{b.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: P.text }}>{b.label}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 60, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.04)',
                    overflow: 'hidden',
                  }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${b.value}%` }}
                      transition={{ delay: 1.6 + i * 0.15, duration: 0.8 }}
                      style={{
                        height: '100%', borderRadius: 2,
                        background: b.value >= 70 ? P.emerald : b.value >= 50 ? P.amber : '#FF6B6B',
                        boxShadow: `0 0 6px ${b.value >= 70 ? P.emerald : b.value >= 50 ? P.amber : '#FF6B6B'}40`,
                      }}
                    />
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
                    color: b.value >= 70 ? P.emerald : b.value >= 50 ? P.amber : '#FF6B6B',
                    minWidth: 28, textAlign: 'right',
                  }}>
                    {b.value}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {!loading && revealed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.2 }}
        >
          <ActionBtn enabled onClick={onComplete} label="Enter Your Operating System →" accent={P.amber} />
        </motion.div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN ONBOARDING FLOW CONTAINER
   ═══════════════════════════════════════════════════════════════ */
export default function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const [bioData, setBioData] = useState({ age: '', weight: '', unit: 'lbs', goal: '' });
  const [syncedSources, setSyncedSources] = useState<Set<string>>(new Set());
  const [selectedProtocols, setSelectedProtocols] = useState<Set<string>>(new Set());
  const [vitalityScore, setVitalityScore] = useState(0);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<{ label: string; value: number; icon: string }[]>([]);

  const upsertVitals = useMutation(api.mutations.upsertUserVitals);
  const upsertPrefs = useMutation(api.mutations.upsertUserPreference);

  const sessionId = typeof window !== 'undefined' ? localStorage.getItem('vive-session-id') || 'guest-user' : 'guest-user';

  const toggleSync = useCallback((id: string) => {
    setSyncedSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleProtocol = useCallback((id: string) => {
    setSelectedProtocols(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Generate vitality score from inputs
  const generateScore = useCallback(async () => {
    setScoreLoading(true);
    setStep(3);

    // Save vitals to DB
    try {
      const weightNum = Number(bioData.weight);
      const weightKg = bioData.unit === 'lbs' ? weightNum * 0.453592 : weightNum;
      await upsertVitals({
        sessionId,
        age: Number(bioData.age),
        gender: 'unspecified',
        weight: weightKg,
        unit: bioData.unit === 'lbs' ? 'imperial' : 'metric',
      });
      await upsertPrefs({
        sessionId,
        userStyle: selectedProtocols.has('holistic') ? 'holistic' : selectedProtocols.has('peptides') ? 'biohacker' : 'optimizer',
        missionProfile: bioData.goal,
      });
    } catch (e) {
      console.warn('[OnboardingFlow] Failed to save vitals:', e);
    }

    // Compute score locally based on inputs
    await new Promise(r => setTimeout(r, 2500));

    const age = Number(bioData.age);
    const hasSyncSources = syncedSources.size > 0;
    const hasAdvancedProtocols = selectedProtocols.has('peptides') || selectedProtocols.has('trt');

    // Base score from age (younger = higher baseline)
    let base = age <= 25 ? 78 : age <= 35 ? 72 : age <= 45 ? 65 : age <= 55 ? 58 : 52;

    // Bonus for data sources
    const dataBonus = Math.min(syncedSources.size * 4, 12);

    // Bonus for protocol sophistication
    const protocolBonus = hasAdvancedProtocols ? 5 : selectedProtocols.has('vitamin-iv') ? 3 : 0;

    // Goal alignment bonus
    const goalBonus = bioData.goal === 'age-reversal' || bioData.goal === 'longevity' ? 3 : 1;

    const total = Math.min(base + dataBonus + protocolBonus + goalBonus, 95);

    // Generate breakdown
    const bk = [
      { label: 'Metabolic Baseline', value: Math.round(base + Math.random() * 6 - 3), icon: '🔥' },
      { label: 'Recovery Potential', value: Math.round(base + 5 + Math.random() * 8 - 4), icon: '💤' },
      { label: 'Cardiovascular', value: Math.round(base + 2 + Math.random() * 10 - 5), icon: '❤️' },
      { label: 'Hormonal Balance', value: Math.round(base - 3 + Math.random() * 8), icon: '⚡' },
      { label: 'Immune Resilience', value: Math.round(base + 1 + Math.random() * 6 - 3), icon: '🛡️' },
      { label: 'Neural Performance', value: Math.round(base + 4 + Math.random() * 8 - 4), icon: '🧠' },
    ];

    setVitalityScore(total);
    setBreakdown(bk);
    setScoreLoading(false);
  }, [bioData, syncedSources, selectedProtocols, sessionId, upsertVitals, upsertPrefs]);

  const handleComplete = useCallback(() => {
    // Mark onboarding complete
    try {
      localStorage.setItem('vive-onboarding-complete', 'true');
      localStorage.setItem('vive-onboarding-score', String(vitalityScore));
    } catch {}
    // Navigate to main app
    window.location.href = '/';
  }, [vitalityScore]);

  return (
    <div style={{
      minHeight: '100vh', background: P.bg, color: P.text,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '40px 20px 60px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: `radial-gradient(circle, ${STEPS[step]?.accent || P.cyan}06 0%, transparent 70%)`,
        pointerEvents: 'none', transition: 'background 1s ease',
      }} />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 28, textAlign: 'center' }}
      >
        <div style={{
          fontSize: 18, fontWeight: 800, letterSpacing: '0.15em',
          background: `linear-gradient(135deg, ${P.cyan}, ${P.emerald})`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          VIVE
        </div>
        <div style={{ fontSize: 8, fontFamily: 'monospace', color: P.textTer, letterSpacing: '0.2em', marginTop: 2 }}>
          BIOLOGICAL OPERATING SYSTEM
        </div>
      </motion.div>

      {/* Progress */}
      <div style={{ marginBottom: 32, width: '100%', maxWidth: 480 }}>
        <GlowProgress step={step} />
      </div>

      {/* Step Content */}
      <div style={{ width: '100%', maxWidth: 440 }}>
        <AnimatePresence mode="wait">
          {step === 0 && (
            <BioScannerStep
              key="scanner"
              data={bioData}
              onChange={setBioData}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <ExternalSyncStep
              key="sync"
              synced={syncedSources}
              onToggle={toggleSync}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <ProtocolStep
              key="protocols"
              selected={selectedProtocols}
              onToggle={toggleProtocol}
              onNext={generateScore}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <BioRevealStep
              key="reveal"
              score={vitalityScore}
              loading={scoreLoading}
              breakdown={breakdown}
              onComplete={handleComplete}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes onb-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>
    </div>
  );
}
