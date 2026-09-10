import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { GlowCard } from '@/components/Dashboard/GlowCard';
import { useGhostMode, getSessionId } from '@/components/Presence/usePresenceState';
import { MealSwapButton, generateWeeklyMealPlan, getTodayKey, computeDayTotals, type PlannedMeal } from '@/components/MealSwapButton';
import GhostLogger from '@/components/GhostLogger';
import QuickFuel from '@/components/QuickFuel';

/* ── Types ── */
interface MealEntry {
  id: string;
  convexId?: Id<'foodLogs'>;
  time: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fuelScore: number;
  microMatch: number;
  source?: 'Voice' | 'Photo' | 'Input' | 'Sync' | 'Pending';
  analysisStatus?: 'pending' | 'analyzed' | 'manual';
  photoStorageId?: string;
}

interface DailyTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/* ── Blood Lab Optimal Ranges ── */
const BLOOD_LAB_TARGETS = {
  vitaminD: { optimal: { min: 40, max: 60 }, unit: 'ng/mL', current: 38 },
  magnesium: { optimal: { min: 1.8, max: 2.4 }, unit: 'mg/dL', current: 2.1 },
  glucose: { optimal: { min: 70, max: 100 }, unit: 'mg/dL', current: 92 },
  ldl: { optimal: { min: 0, max: 100 }, unit: 'mg/dL', current: 118 },
};

/* ── Impact messages based on meal content ── */
function getImpactMessage(meal: { name: string; protein: number; carbs: number; fat: number; calories: number }): string {
  const lower = meal.name.toLowerCase();
  if (lower.includes('salmon') || lower.includes('fish') || lower.includes('tuna'))
    return 'Boosting your Vitamin D levels...';
  if (lower.includes('spinach') || lower.includes('almond') || lower.includes('nut') || lower.includes('avocado'))
    return 'Supporting your Magnesium balance...';
  if (lower.includes('salad') || lower.includes('veggie') || lower.includes('greens') || lower.includes('chicken'))
    return 'Improving your LDL profile...';
  if (lower.includes('pizza') || lower.includes('burger') || lower.includes('fries') || lower.includes('pasta'))
    return 'Watch your Glucose stability...';
  if (meal.protein > 30 && meal.carbs < 30)
    return 'Great for Glucose stability...';
  if (meal.carbs > 50)
    return 'Impacting your Glucose stability...';
  return 'Impacting your Glucose stability...';
}

/* ── Fuel Quality Scoring Engine ── */
function computeFuelScore(meal: { name: string; protein: number; carbs: number; fat: number; calories: number }): { score: number; microMatch: number } {
  const lower = meal.name.toLowerCase();
  let score = 5;
  let microPoints = 0;
  const maxMicroPoints = 4;

  if (lower.includes('salmon') || lower.includes('fish') || lower.includes('tuna') || lower.includes('mackerel')) {
    score += 1.5; microPoints += 1;
  } else if (lower.includes('egg') || lower.includes('mushroom')) {
    score += 0.5; microPoints += 0.5;
  }

  if (lower.includes('spinach') || lower.includes('almond') || lower.includes('nut') || lower.includes('avocado') || lower.includes('greens')) {
    score += 1; microPoints += 1;
  } else if (lower.includes('oat') || lower.includes('rice') || lower.includes('quinoa') || lower.includes('banana')) {
    score += 0.5; microPoints += 0.5;
  }

  if (meal.protein > 30 && meal.carbs < 30) {
    score += 1; microPoints += 1;
  } else if (lower.includes('pizza') || lower.includes('fries') || lower.includes('burger') || lower.includes('pasta') || lower.includes('candy')) {
    score -= 1.5; microPoints -= 0.5;
  } else if (meal.carbs < 50) {
    score += 0.5; microPoints += 0.5;
  }

  if (lower.includes('salad') || lower.includes('veggie') || lower.includes('greens') || lower.includes('chicken')) {
    score += 1; microPoints += 1;
  } else if (meal.fat > 30) {
    score -= 0.5;
  }

  if (meal.protein > 25) score += 0.5;
  if (meal.calories > 600) score -= 0.5;

  const finalScore = Math.max(1, Math.min(10, Math.round(score)));
  const microMatch = Math.max(0, Math.min(100, Math.round((Math.max(0, microPoints) / maxMicroPoints) * 100)));
  return { score: finalScore, microMatch };
}

/* ── Mock AI Parser ── */
async function mockAIParseMeal(input: string): Promise<MealEntry> {
  await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));

  const lower = input.toLowerCase();
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let base: { calories: number; protein: number; carbs: number; fat: number };

  if (lower.includes('chicken') || lower.includes('grilled')) {
    base = { calories: 420, protein: 48, carbs: 12, fat: 18 };
  } else if (lower.includes('salmon') || lower.includes('fish')) {
    base = { calories: 380, protein: 42, carbs: 6, fat: 20 };
  } else if (lower.includes('oat') || lower.includes('porridge') || lower.includes('breakfast')) {
    base = { calories: 350, protein: 18, carbs: 52, fat: 10 };
  } else if (lower.includes('salad') || lower.includes('greens') || lower.includes('veggie')) {
    base = { calories: 220, protein: 12, carbs: 18, fat: 14 };
  } else if (lower.includes('shake') || lower.includes('protein') || lower.includes('whey')) {
    base = { calories: 280, protein: 35, carbs: 22, fat: 8 };
  } else if (lower.includes('rice') || lower.includes('bowl')) {
    base = { calories: 510, protein: 28, carbs: 65, fat: 14 };
  } else if (lower.includes('egg') || lower.includes('omelet') || lower.includes('omelette')) {
    base = { calories: 310, protein: 24, carbs: 4, fat: 22 };
  } else if (lower.includes('pizza') || lower.includes('burger') || lower.includes('fries')) {
    base = { calories: 680, protein: 22, carbs: 72, fat: 34 };
  } else if (lower.includes('smoothie') || lower.includes('fruit') || lower.includes('banana')) {
    base = { calories: 240, protein: 8, carbs: 48, fat: 4 };
  } else if (lower.includes('steak') || lower.includes('beef')) {
    base = { calories: 520, protein: 52, carbs: 2, fat: 32 };
  } else if (lower.includes('pasta') || lower.includes('spaghetti') || lower.includes('noodle')) {
    base = { calories: 560, protein: 18, carbs: 78, fat: 16 };
  } else if (lower.includes('toast') || lower.includes('bread') || lower.includes('sandwich')) {
    base = { calories: 380, protein: 16, carbs: 42, fat: 16 };
  } else {
    const seed = input.length;
    base = {
      calories: 200 + (seed * 37) % 400,
      protein: 10 + (seed * 13) % 40,
      carbs: 15 + (seed * 19) % 60,
      fat: 5 + (seed * 7) % 25,
    };
  }

  const name = extractName(input);
  const { score, microMatch } = computeFuelScore({ name, ...base });

  return { id: crypto.randomUUID(), time, name, ...base, fuelScore: score, microMatch };
}

function extractName(input: string): string {
  const cleaned = input.trim().replace(/\s+/g, ' ');
  const titled = cleaned.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return titled.length > 30 ? titled.slice(0, 27) + '...' : titled;
}

/* ── Fuel Score Ring ── */
function FuelScoreRing({ score, ghostMode }: { score: number; ghostMode: boolean }) {
  const radius = 32;
  const stroke = 4;
  const circumference = 2 * Math.PI * radius;
  const pct = score / 10;
  const offset = circumference * (1 - pct);

  const getColor = (s: number) => {
    if (s >= 8) return '#30D158';
    if (s >= 6) return '#00FFCC';
    if (s >= 4) return '#FBBF24';
    return '#FF6B6B';
  };

  const color = ghostMode ? 'rgba(160,160,160,0.5)' : getColor(score);
  const label = score >= 8 ? 'Excellent' : score >= 6 ? 'Good' : score >= 4 ? 'Fair' : 'Poor';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: (radius + stroke) * 2, height: (radius + stroke) * 2 }}>
        <svg width={(radius + stroke) * 2} height={(radius + stroke) * 2} className="transform -rotate-90">
          <circle cx={radius + stroke} cy={radius + stroke} r={radius} fill="none" stroke={ghostMode ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)'} strokeWidth={stroke} />
          <motion.circle cx={radius + stroke} cy={radius + stroke} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }} style={{ filter: ghostMode ? 'none' : `drop-shadow(0 0 4px ${color}60)` }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold tabular-nums leading-none" style={{ color }}>{score}</span>
          <span className="text-[8px] uppercase tracking-wider mt-0.5" style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.3)' }}>/10</span>
        </div>
      </div>
      <span className="text-[9px] uppercase tracking-wider" style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : `${color}CC` }}>{label}</span>
    </div>
  );
}

/* ── Micro-nutrient Match Bar ── */
function MicroMatchBar({ percentage, ghostMode, neon }: { percentage: number; ghostMode: boolean; neon: string }) {
  const getColor = (p: number) => {
    if (p >= 75) return '#30D158';
    if (p >= 50) return '#00FFCC';
    if (p >= 25) return '#FBBF24';
    return '#FF6B6B';
  };
  const color = ghostMode ? 'rgba(160,160,160,0.5)' : getColor(percentage);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: `${neon}0.45)` }}>Micro-nutrient Match</span>
        <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>{percentage}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }} style={{ background: color, boxShadow: ghostMode ? 'none' : `0 0 8px ${color}40` }} />
      </div>
      <div className="flex items-center gap-3 mt-0.5">
        {[
          { label: 'Vit D', icon: '\u2600\uFE0F', active: percentage > 20 },
          { label: 'Mg', icon: '\uD83D\uDC8E', active: percentage > 40 },
          { label: 'Glucose', icon: '\uD83E\uDE78', active: percentage > 60 },
          { label: 'LDL', icon: '\u2764\uFE0F\u200D\uD83E\uDE79', active: percentage > 30 },
        ].map((m) => (
          <div key={m.label} className="flex items-center gap-1">
            <span style={{ fontSize: 10, filter: ghostMode ? 'grayscale(1) opacity(0.4)' : m.active ? 'none' : 'grayscale(1) opacity(0.3)' }}>{m.icon}</span>
            <span className="text-[8px] uppercase" style={{ color: m.active ? (ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(255,255,255,0.5)') : 'rgba(255,255,255,0.15)' }}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Macro Card ── */
function MacroCard({ label, current, target, unit, color, ghostMode, neon, animateKey }: { label: string; current: number; target: number; unit: string; color: string; ghostMode: boolean; neon: string; animateKey: number }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  const isOver = current > target;

  return (
    <GlowCard className="p-4" glowRadius={160}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: `${neon}0.5)` }}>{label}</span>
          <span className="text-[10px] tabular-nums" style={{ color: isOver ? '#FF6B6B' : `${neon}0.35)` }}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <motion.div key={animateKey} className="h-full rounded-full absolute inset-y-0 left-0" initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }} transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }} style={{ background: ghostMode ? 'rgba(160,160,160,0.4)' : isOver ? '#FF6B6B' : color, boxShadow: ghostMode ? 'none' : `0 0 10px ${isOver ? '#FF6B6B' : color}50, 0 0 20px ${isOver ? '#FF6B6B' : color}20` }} />
        </div>
        <div className="flex items-baseline gap-1.5">
          <motion.span key={`${animateKey}-val`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }} className="text-base font-bold tabular-nums" style={{ color: ghostMode ? 'rgba(200,200,200,0.6)' : color }}>{current}{unit}</motion.span>
          <span className="text-[9px]" style={{ color: `${neon}0.25)` }}>/ {target}{unit}</span>
        </div>
      </div>
    </GlowCard>
  );
}

/* ── Waveform Bars for Listening State ── */
function ListeningWaveform({ ghostMode }: { ghostMode: boolean }) {
  const [bars, setBars] = useState<number[]>(Array(20).fill(0.15));
  const phaseRef = useRef(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const animate = () => {
      phaseRef.current += 0.1;
      const phase = phaseRef.current;
      const newBars = Array.from({ length: 20 }, (_, i) => {
        const base = 0.2;
        const wave1 = Math.sin(phase + i * 0.5) * 0.3;
        const wave2 = Math.sin(phase * 1.6 + i * 0.3) * 0.2;
        const wave3 = Math.cos(phase * 0.7 + i * 0.7) * 0.15;
        const noise = Math.random() * 0.08;
        return Math.max(0.08, Math.min(1, base + wave1 + wave2 + wave3 + noise));
      });
      setBars(newBars);
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  const color1 = ghostMode ? 'rgba(160,160,160,0.5)' : '#AF82FF';
  const color2 = ghostMode ? 'rgba(160,160,160,0.3)' : '#00FFCC';

  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{
            width: 3,
            background: `linear-gradient(to top, ${color1}, ${color2})`,
            opacity: ghostMode ? 0.4 : 0.8,
          }}
          animate={{ height: h * 28 + 4 }}
          transition={{ duration: 0.08, ease: 'linear' }}
        />
      ))}
    </div>
  );
}

/* ── Vive Listening Overlay ── */
function ViveListeningOverlay({ ghostMode, transcript, isListening }: { ghostMode: boolean; transcript: string; isListening: boolean }) {
  const purple = ghostMode ? 'rgba(160,160,160,' : 'rgba(175,130,255,';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="flex flex-col items-center gap-4 py-6"
    >
      <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
        {isListening && (
          <>
            <motion.div className="absolute inset-0 rounded-full" animate={{ scale: [1, 1.6, 1.6], opacity: [0.3, 0, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }} style={{ border: `2px solid ${ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(175,130,255,0.3)'}` }} />
            <motion.div className="absolute inset-0 rounded-full" animate={{ scale: [1, 1.4, 1.4], opacity: [0.2, 0, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }} style={{ border: `1.5px solid ${ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(0,255,204,0.25)'}` }} />
          </>
        )}
        <div className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center" style={{ background: ghostMode ? 'radial-gradient(circle at 35% 35%, rgba(160,160,160,0.15), rgba(10,10,10,0.95))' : 'conic-gradient(from 135deg, #AF82FF, #00FFCC, #AF82FF)', boxShadow: ghostMode ? '0 0 20px rgba(160,160,160,0.1)' : '0 0 30px rgba(175,130,255,0.35), 0 0 60px rgba(0,255,204,0.15)' }}>
          <div className="w-[85%] h-[85%] rounded-full flex items-center justify-center" style={{ background: ghostMode ? 'radial-gradient(circle at 35% 35%, rgba(30,30,30,0.9), rgba(10,10,10,0.98))' : 'radial-gradient(circle at 35% 35%, rgba(15,8,25,0.9), rgba(5,12,10,0.95))' }}>
            <span className="text-xl font-bold select-none" style={{ color: ghostMode ? '#a0a0a0' : '#AF82FF', textShadow: ghostMode ? 'none' : '0 0 12px rgba(175,130,255,0.6), 0 0 24px rgba(0,255,204,0.2)' }}>V</span>
          </div>
        </div>
      </div>
      {isListening && <ListeningWaveform ghostMode={ghostMode} />}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: `${purple}0.6)` }}>{isListening ? 'Listening...' : transcript ? 'Processing...' : 'Ready'}</span>
        {transcript && (
          <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-center max-w-xs" style={{ color: ghostMode ? 'rgba(200,200,200,0.7)' : 'rgba(255,255,255,0.7)' }}>"{transcript}"</motion.p>
        )}
      </div>
    </motion.div>
  );
}

/* ── Fuel Updated Toast ── */
function FuelToast({ message, detail, ghostMode, onDismiss }: { message: string; detail: string; ghostMode: boolean; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const purple = ghostMode ? 'rgba(160,160,160,' : 'rgba(175,130,255,';

  return (
    <motion.div initial={{ opacity: 0, y: -16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16, scale: 0.95 }} transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }} className="w-full rounded-2xl border px-4 py-3 flex items-center gap-3" style={{ background: ghostMode ? 'rgba(20,20,20,0.95)' : 'rgba(8,6,14,0.95)', borderColor: ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(175,130,255,0.2)', backdropFilter: 'blur(20px)', boxShadow: ghostMode ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,0,0,0.4), 0 0 30px rgba(175,130,255,0.08)' }}>
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${purple}0.12)`, border: `1px solid ${purple}0.2)` }}>
        <span className="text-sm" style={{ filter: ghostMode ? 'grayscale(1) opacity(0.5)' : 'none' }}>{'\u26A1'}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium leading-tight" style={{ color: ghostMode ? 'rgba(220,220,220,0.8)' : 'rgba(255,255,255,0.9)' }}>{message}</p>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(175,130,255,0.5)' }}>{detail}</p>
      </div>
      <button onClick={onDismiss} className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.2)' }}>{'\u2715'}</button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── SLOT ICON + COLOR HELPERS ── */
/* ══════════════════════════════════════════════════════════════ */
const SLOT_META: Record<string, { icon: string; color: string; label: string }> = {
  breakfast: { icon: '\uD83E\uDD5A', color: '#FFB86B', label: 'Breakfast' },
  lunch: { icon: '\uD83E\uDD57', color: '#00FFCC', label: 'Lunch' },
  snack: { icon: '\uD83C\uDF4E', color: '#AF82FF', label: 'Snack' },
  dinner: { icon: '\uD83C\uDF73', color: '#6B8AFF', label: 'Dinner' },
};

/* ══════════════════════════════════════════════════════════════ */
/* ── WEEKLY MEAL PLANNER GRID ── */
/* ══════════════════════════════════════════════════════════════ */
function WeeklyMealPlanner({
  ghostMode,
  neon,
  purple,
  weekPlan,
  onSwapMeal,
}: {
  ghostMode: boolean;
  neon: string;
  purple: string;
  weekPlan: Record<string, PlannedMeal[]>;
  onSwapMeal: (day: string, oldMeal: PlannedMeal, newMeal: PlannedMeal) => void;
}) {
  const todayKey = getTodayKey();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const [selectedDay, setSelectedDay] = useState(todayKey);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dayMeals = weekPlan[selectedDay] || [];
  const dayTotals = computeDayTotals(dayMeals);
  const isToday = selectedDay === todayKey;

  // Auto-scroll to today on mount
  useEffect(() => {
    if (scrollRef.current) {
      const todayIdx = days.indexOf(todayKey);
      const btn = scrollRef.current.children[todayIdx] as HTMLElement;
      if (btn) {
        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, []);

  return (
    <GlowCard className="p-0 overflow-hidden" glowRadius={300}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${purple}0.12)`, border: `1px solid ${purple}0.2)` }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="3" width="14" height="12" rx="2" stroke={ghostMode ? 'rgba(160,160,160,0.5)' : '#AF82FF'} strokeWidth="1.3" />
                <path d="M1 7H15" stroke={ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(175,130,255,0.4)'} strokeWidth="1" />
                <path d="M5 1V4M11 1V4" stroke={ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(175,130,255,0.5)'} strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: `${purple}0.7)` }}>
                Vive Meal Planner
              </span>
              <span className="text-[9px] block mt-0.5 uppercase tracking-wider" style={{ color: `${neon}0.3)` }}>
                Macro-optimized weekly plan
              </span>
            </div>
          </div>
          {/* Weekly avg fuel score */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: `${neon}0.06)`, border: `1px solid ${neon}0.1)` }}>
            <span className="text-[8px]">{'\u26A1'}</span>
            <span className="text-[10px] font-bold tabular-nums" style={{ color: `${neon}0.7)` }}>
              {dayTotals.avgFuelScore}
            </span>
            <span className="text-[8px] uppercase tracking-wider" style={{ color: `${neon}0.4)` }}>avg</span>
          </div>
        </div>

        {/* Day selector */}
        <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {days.map((day) => {
            const isActive = day === selectedDay;
            const isTodayDay = day === todayKey;
            const dayTotal = computeDayTotals(weekPlan[day] || []);
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all duration-200 flex-shrink-0 relative"
                style={{
                  background: isActive
                    ? ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(175,130,255,0.12)'
                    : 'transparent',
                  border: `1px solid ${isActive
                    ? ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(175,130,255,0.25)'
                    : 'rgba(255,255,255,0.03)'}`,
                }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{
                  color: isActive
                    ? ghostMode ? 'rgba(200,200,200,0.8)' : '#AF82FF'
                    : ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.35)',
                }}>
                  {day}
                </span>
                <span className="text-[8px] tabular-nums" style={{
                  color: isActive
                    ? ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(175,130,255,0.5)'
                    : 'rgba(255,255,255,0.15)',
                }}>
                  {dayTotal.calories}
                </span>
                {isTodayDay && (
                  <div className="absolute -top-0.5 right-1 w-1.5 h-1.5 rounded-full" style={{
                    background: ghostMode ? 'rgba(160,160,160,0.4)' : '#00FFCC',
                    boxShadow: ghostMode ? 'none' : '0 0 6px rgba(0,255,204,0.5)',
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px" style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : 'linear-gradient(90deg, rgba(175,130,255,0.1), rgba(0,255,204,0.05), transparent)' }} />

      {/* Day macro summary bar */}
      <div className="px-4 py-2.5 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>
            {isToday ? 'Today' : selectedDay}
          </span>
        </div>
        <div className="flex-1 flex items-center gap-3">
          {[
            { label: 'Cal', value: dayTotals.calories, color: '#FF6BB5' },
            { label: 'P', value: `${dayTotals.protein}g`, color: '#00FFCC' },
            { label: 'C', value: `${dayTotals.carbs}g`, color: '#6B8AFF' },
            { label: 'F', value: `${dayTotals.fat}g`, color: '#FFB86B' },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-1">
              <span className="text-[8px] uppercase" style={{ color: 'rgba(255,255,255,0.2)' }}>{m.label}</span>
              <span className="text-[10px] font-bold tabular-nums" style={{ color: ghostMode ? 'rgba(200,200,200,0.5)' : `${m.color}CC` }}>
                {m.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Meal cards */}
      <div className="px-3 pb-3 flex flex-col gap-2">
        <AnimatePresence mode="wait">
          {dayMeals.map((meal, idx) => {
            const meta = SLOT_META[meal.slot] || SLOT_META.lunch;
            return (
              <motion.div
                key={`${selectedDay}-${meal.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, delay: idx * 0.05 }}
                className="rounded-xl border p-3 relative group"
                style={{
                  background: ghostMode ? 'rgba(20,20,20,0.4)' : 'rgba(255,255,255,0.015)',
                  borderColor: ghostMode ? 'rgba(160,160,160,0.06)' : `${meta.color}15`,
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Time + slot icon */}
                  <div className="flex flex-col items-center gap-1 min-w-[36px]">
                    <span className="text-[10px] tabular-nums font-medium" style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : `${meta.color}88` }}>
                      {meal.time}
                    </span>
                    <span style={{ fontSize: 14, filter: ghostMode ? 'grayscale(1) opacity(0.4)' : 'none' }}>{meta.icon}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-[8px] uppercase tracking-[0.15em] font-semibold" style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : `${meta.color}66` }}>
                          {meta.label}
                        </span>
                        <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: ghostMode ? 'rgba(200,200,200,0.7)' : 'rgba(255,255,255,0.8)' }}>
                          {meal.name}
                        </p>
                      </div>
                      {/* Swap button */}
                      <MealSwapButton
                        meal={meal}
                        onSwap={(old, newM) => onSwapMeal(selectedDay, old, newM)}
                        compact
                      />
                    </div>

                    {/* Macro pills */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: ghostMode ? 'rgba(200,200,200,0.5)' : `${meta.color}BB` }}>
                        {meal.calories} cal
                      </span>
                      <div className="flex gap-1.5">
                        <MacroPill label="P" value={`${meal.protein}g`} color="#00FFCC" ghostMode={ghostMode} />
                        <MacroPill label="C" value={`${meal.carbs}g`} color="#6B8AFF" ghostMode={ghostMode} />
                        <MacroPill label="F" value={`${meal.fat}g`} color="#FFB86B" ghostMode={ghostMode} />
                      </div>
                      {/* Fuel score badge */}
                      <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded tabular-nums" style={{
                        color: ghostMode ? 'rgba(160,160,160,0.5)' : meal.fuelScore >= 8 ? '#30D158' : meal.fuelScore >= 6 ? '#00FFCC' : '#FBBF24',
                        background: ghostMode ? 'rgba(160,160,160,0.06)' : meal.fuelScore >= 8 ? 'rgba(48,209,88,0.1)' : meal.fuelScore >= 6 ? 'rgba(0,255,204,0.08)' : 'rgba(251,191,36,0.08)',
                        border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : meal.fuelScore >= 8 ? 'rgba(48,209,88,0.15)' : meal.fuelScore >= 6 ? 'rgba(0,255,204,0.12)' : 'rgba(251,191,36,0.12)'}`,
                      }}>
                        {'\u26A1'}{meal.fuelScore}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Subtle left accent bar */}
                <div className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full" style={{
                  background: ghostMode ? 'rgba(160,160,160,0.1)' : `${meta.color}30`,
                }} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </GlowCard>
  );
}

/* ══════════════════════════════════════════════════════ */
/* ── Main NutritionView ── */
/* ══════════════════════════════════════════════════════ */
export function NutritionView({ mounted }: { mounted?: boolean }) {
  const ghostMode = useGhostMode();
  const neon = ghostMode ? 'rgba(160,160,160,' : 'rgba(0,255,204,';
  const purple = ghostMode ? 'rgba(160,160,160,' : 'rgba(175,130,255,';
  const inputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const sessionId = useMemo(() => getSessionId(), []);

  const logFoodPending = useMutation(api.logs.logFoodPending);
  const updateFoodLog = useMutation(api.logs.updateFoodLog);
  const generateUploadUrl = useMutation(api.vaultFiles.generateUploadUrl);
  const todayLogs = useQuery(api.logs.getTodayFoodLogs, { sessionId });

  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [animateKey, setAnimateKey] = useState(0);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [manualEditId, setManualEditId] = useState<string | null>(null);
  const [manualMacros, setManualMacros] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [showGhostLogger, setShowGhostLogger] = useState(true);

  // Vive voice logging state
  const [viveListening, setViveListening] = useState(false);
  const [viveTranscript, setViveTranscript] = useState('');
  const [viveActive, setViveActive] = useState(false);

  // Toast state
  const [fuelToast, setFuelToast] = useState<{ message: string; detail: string } | null>(null);

  // Weekly meal plan state
  const [weekPlan, setWeekPlan] = useState<Record<string, PlannedMeal[]>>(() => generateWeeklyMealPlan());

  const targets: DailyTargets = { calories: 2400, protein: 160, carbs: 250, fat: 70 };

  const meals: MealEntry[] = useMemo(() => {
    if (!todayLogs) return [];
    return [...todayLogs]
      .sort((a, b) => b.loggedAt - a.loggedAt)
      .map((l) => {
        const pending = (l as any).analysisStatus === 'pending'
          || String(l.source || '').includes('pending');
        const d = new Date(l.loggedAt);
        const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const { score, microMatch } = pending
          ? { score: 0, microMatch: 0 }
          : computeFuelScore({ name: l.name, protein: l.protein, carbs: l.carbs, fat: l.fat, calories: l.calories });
        let source: MealEntry['source'] = 'Input';
        if (pending) source = 'Pending';
        else if (l.source?.includes('photo') || (l as any).photoStorageId) source = 'Photo';
        else if (l.source?.includes('voice')) source = 'Voice';
        return {
          id: String(l._id),
          convexId: l._id,
          time,
          name: l.name,
          calories: l.calories,
          protein: l.protein,
          carbs: l.carbs,
          fat: l.fat,
          fuelScore: score,
          microMatch,
          source,
          analysisStatus: pending ? 'pending' : ((l as any).analysisStatus as MealEntry['analysisStatus']) || 'analyzed',
          photoStorageId: (l as any).photoStorageId,
        };
      });
  }, [todayLogs]);

  const analyzedMeals = useMemo(
    () => meals.filter((m) => m.analysisStatus !== 'pending'),
    [meals],
  );

  const totals = analyzedMeals.reduce(
    (acc, m) => ({ calories: acc.calories + m.calories, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const dailyFuelScore = useMemo(() => {
    if (analyzedMeals.length === 0) return 0;
    return Math.round(analyzedMeals.reduce((sum, m) => sum + m.fuelScore, 0) / analyzedMeals.length);
  }, [analyzedMeals]);

  const dailyMicroMatch = useMemo(() => {
    if (analyzedMeals.length === 0) return 0;
    return Math.round(analyzedMeals.reduce((sum, m) => sum + m.microMatch, 0) / analyzedMeals.length);
  }, [analyzedMeals]);

  const macros = [
    { label: 'Protein', current: totals.protein, target: targets.protein, unit: 'g', color: '#00FFCC' },
    { label: 'Carbs', current: totals.carbs, target: targets.carbs, unit: 'g', color: '#6B8AFF' },
    { label: 'Fats', current: totals.fat, target: targets.fat, unit: 'g', color: '#FFB86B' },
    { label: 'Calories', current: totals.calories, target: targets.calories, unit: '', color: '#FF6BB5' },
  ];

  const toastLogged = useCallback((name: string, pending: boolean) => {
    setAnimateKey((k) => k + 1);
    setJustAdded(name);
    setTimeout(() => setJustAdded(null), 2000);
    setFuelToast({
      message: pending ? 'Food saved — pending analysis' : `Fuel updated. ${name}`,
      detail: pending
        ? 'Text stored. No macros claimed (AI off). Enter manually anytime.'
        : getImpactMessage({ name, protein: 0, carbs: 0, fat: 0, calories: 0 }),
    });
  }, []);

  const handleLogMeal = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isProcessing) return;
    setIsProcessing(true);
    try {
      await logFoodPending({
        sessionId,
        name: text,
        source: 'text-pending',
        notes: 'Logged from Nutrition view (text)',
      });
      toastLogged(text, true);
      setInputValue('');
    } catch (err: any) {
      setFuelToast({
        message: 'Could not save food log',
        detail: err?.message || 'Convex mutation failed',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [inputValue, isProcessing, logFoodPending, sessionId, toastLogged]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleLogMeal(); }
  }, [handleLogMeal]);

  const handleManualSave = useCallback(async (meal: MealEntry) => {
    if (!meal.convexId) return;
    const calories = Number(manualMacros.calories) || 0;
    const protein = Number(manualMacros.protein) || 0;
    const carbs = Number(manualMacros.carbs) || 0;
    const fat = Number(manualMacros.fat) || 0;
    await updateFoodLog({
      id: meal.convexId,
      calories,
      protein,
      carbs,
      fat,
      analysisStatus: 'manual',
    });
    setManualEditId(null);
    setFuelToast({
      message: 'Macros saved (manual entry)',
      detail: `${calories} kcal · ${protein}g P · ${carbs}g C · ${fat}g F`,
    });
  }, [manualMacros, updateFoodLog]);

  const handlePhotoCapture = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'image/jpeg' },
        body: file,
      });
      if (!res.ok) throw new Error('Photo upload failed');
      const { storageId } = await res.json();
      const caption = inputValue.trim() || file.name || 'Meal photo';
      await logFoodPending({
        sessionId,
        name: caption,
        source: 'photo-pending',
        notes: 'Photo stored only — pending analysis',
        photoStorageId: storageId,
      });
      toastLogged(caption, true);
      setInputValue('');
    } catch (err: any) {
      setFuelToast({
        message: 'Photo save failed',
        detail: err?.message || 'Could not store photo',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [generateUploadUrl, inputValue, logFoodPending, sessionId, toastLogged]);

  const handleViveLog = useCallback(() => {
    if (viveActive || isProcessing) return;
    setViveActive(true);
    setViveListening(true);
    setViveTranscript('');
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setViveListening(false);
      setViveActive(false);
      setFuelToast({
        message: 'Voice not available',
        detail: 'Type your meal below — it will save as pending analysis.',
      });
      inputRef.current?.focus();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let lastTranscript = '';
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      lastTranscript = transcript;
      setViveTranscript(transcript);
    };
    recognition.onerror = () => {
      setViveListening(false);
      setViveActive(false);
    };
    recognition.onend = async () => {
      setViveListening(false);
      const picked = lastTranscript.trim();
      if (!picked) {
        setViveActive(false);
        setViveTranscript('');
        return;
      }
      try {
        await logFoodPending({
          sessionId,
          name: picked,
          source: 'voice-pending',
          notes: 'Voice log — pending analysis',
        });
        toastLogged(picked, true);
      } catch (err: any) {
        setFuelToast({ message: 'Voice log failed', detail: err?.message || 'Save failed' });
      }
      setTimeout(() => { setViveActive(false); setViveTranscript(''); }, 600);
    };
    recognition.start();
  }, [viveActive, isProcessing, sessionId, logFoodPending, toastLogged]);

  // Handle meal swap in weekly planner
  const handleSwapMeal = useCallback((day: string, oldMeal: PlannedMeal, newMeal: PlannedMeal) => {
    setWeekPlan((prev) => {
      const updated = { ...prev };
      updated[day] = (updated[day] || []).map((m) => m.id === oldMeal.id ? newMeal : m);
      return updated;
    });
    setFuelToast({
      message: `Swapped: ${oldMeal.name} \u2192 ${newMeal.name}`,
      detail: `${newMeal.calories} cal \u00b7 Fuel Score ${newMeal.fuelScore}/10`,
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: ghostMode ? 'rgba(200,200,200,0.6)' : '#00FFCC' }}>Food</h2>
          <p className="text-xs tracking-widest uppercase mt-1" style={{ color: `${neon}0.4)` }}>Fuel Matrix {'\u00b7'} Today</p>
        </div>
        <GlowCard className="px-4 py-2" glowRadius={150}>
          <div className="text-center">
            <motion.span key={totals.calories} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-lg font-bold tabular-nums" style={{ color: ghostMode ? 'rgba(200,200,200,0.7)' : '#00FFCC' }}>{totals.calories.toLocaleString()}</motion.span>
            <span className="text-[9px] block" style={{ color: `${neon}0.4)` }}>/ {targets.calories.toLocaleString()} kcal</span>
          </div>
        </GlowCard>
      </div>

      {/* Fuel Updated Toast */}
      <AnimatePresence>
        {fuelToast && <FuelToast message={fuelToast.message} detail={fuelToast.detail} ghostMode={ghostMode} onDismiss={() => setFuelToast(null)} />}
      </AnimatePresence>

      {/* ── Ghost-Log (text → foodLogs under twin session) ── */}
      <GlowCard className="p-4" glowRadius={280}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-[0.15em]" style={{ color: `${neon}0.5)` }}>
            Text food log · twin session
          </span>
          <button
            type="button"
            onClick={() => setShowGhostLogger((v) => !v)}
            className="text-[9px] px-2 py-1 rounded-md border"
            style={{ color: `${neon}0.55)`, borderColor: `${neon}0.15)` }}
          >
            {showGhostLogger ? 'Hide' : 'Show'} Ghost-Log
          </button>
        </div>
        {showGhostLogger && <GhostLogger sessionId={sessionId} compact />}
        {!showGhostLogger && (
          <p className="text-[10px]" style={{ color: `${neon}0.35)` }}>
            Open Ghost-Log or use Quick Log below. Without AI, entries save as pending analysis (no invented macros).
          </p>
        )}
      </GlowCard>

      {/* ══════════════════════════════════════════════════════ */}
      {/* ── WEEKLY MEAL PLANNER ── */}
      {/* ══════════════════════════════════════════════════════ */}
      <WeeklyMealPlanner
        ghostMode={ghostMode}
        neon={neon}
        purple={purple}
        weekPlan={weekPlan}
        onSwapMeal={handleSwapMeal}
      />

      {/* ── LOG WITH VIVE BUTTON ── */}
      <AnimatePresence mode="wait">
        {viveActive ? (
          <GlowCard key="vive-listening" className="p-2 overflow-hidden" glowRadius={300}>
            <ViveListeningOverlay ghostMode={ghostMode} transcript={viveTranscript} isListening={viveListening} />
          </GlowCard>
        ) : (
          <motion.div key="vive-button" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button
              onClick={handleViveLog}
              className="w-full group relative overflow-hidden rounded-2xl border transition-all duration-300 active:scale-[0.98]"
              style={{
                background: ghostMode ? 'rgba(160,160,160,0.04)' : 'linear-gradient(135deg, rgba(175,130,255,0.08) 0%, rgba(0,255,204,0.06) 50%, rgba(175,130,255,0.04) 100%)',
                borderColor: ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(175,130,255,0.2)',
                boxShadow: ghostMode ? 'none' : '0 0 30px rgba(175,130,255,0.06), 0 0 60px rgba(0,255,204,0.03)',
              }}
            >
              {!ghostMode && (
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(105deg, transparent 20%, rgba(175,130,255,0.06) 40%, rgba(0,255,204,0.04) 60%, transparent 80%)', backgroundSize: '200% 100%', animation: 'viveShimmer 4s ease-in-out infinite' }} />
              )}
              <div className="relative flex items-center justify-center gap-3 px-6 py-4">
                <div className="relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: ghostMode ? 'radial-gradient(circle at 35% 35%, rgba(160,160,160,0.12), rgba(10,10,10,0.9))' : 'conic-gradient(from 135deg, #AF82FF, #00FFCC, #AF82FF)', boxShadow: ghostMode ? '0 0 10px rgba(160,160,160,0.06)' : '0 0 16px rgba(175,130,255,0.3), 0 0 32px rgba(0,255,204,0.12)' }}>
                  <div className="w-[82%] h-[82%] rounded-full flex items-center justify-center" style={{ background: ghostMode ? 'radial-gradient(circle, rgba(25,25,25,0.95), rgba(10,10,10,0.98))' : 'radial-gradient(circle at 35% 35%, rgba(12,6,20,0.92), rgba(5,10,8,0.96))' }}>
                    <span className="text-sm font-bold" style={{ color: ghostMode ? '#a0a0a0' : '#AF82FF', textShadow: ghostMode ? 'none' : '0 0 8px rgba(175,130,255,0.5)' }}>V</span>
                  </div>
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold tracking-wide" style={{ color: ghostMode ? 'rgba(200,200,200,0.7)' : '#AF82FF', textShadow: ghostMode ? 'none' : '0 0 12px rgba(175,130,255,0.2)' }}>Log with Vive</span>
                  <span className="text-[10px]" style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(175,130,255,0.4)' }}>Tap to speak your meal</span>
                </div>
                <div className="ml-auto flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ghostMode ? 'rgba(160,160,160,0.4)' : '#AF82FF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: ghostMode ? 'none' : 'drop-shadow(0 0 4px rgba(175,130,255,0.3))' }}>
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                </div>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DAILY FUEL SUMMARY ── */}
      <GlowCard className="p-5" glowRadius={250}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 14, filter: ghostMode ? 'grayscale(1) opacity(0.4)' : 'none' }}>{'\u26A1'}</span>
              <span className="text-[11px] uppercase tracking-[0.15em] font-semibold" style={{ color: `${neon}0.6)` }}>Daily Fuel Summary</span>
            </div>
            {meals.length > 0 && (
              <span className="text-[10px] tabular-nums px-2 py-0.5 rounded-full" style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(0,255,204,0.6)', background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(0,255,204,0.06)', border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(0,255,204,0.1)'}` }}>
                {meals.length} meal{meals.length !== 1 ? 's' : ''} logged
              </span>
            )}
          </div>

          {analyzedMeals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <span className="text-2xl" style={{ opacity: 0.2, filter: ghostMode ? 'grayscale(1)' : 'none' }}>{'\u26A1'}</span>
              <span className="text-[11px] text-center" style={{ color: `${neon}0.3)` }}>
                {meals.some((m) => m.analysisStatus === 'pending')
                  ? 'Meals saved as pending analysis — enter macros manually to score fuel quality'
                  : 'Log your first meal to see your Fuel Quality score'}
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-5">
              <FuelScoreRing score={dailyFuelScore} ghostMode={ghostMode} />
              <div className="flex-1 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {[
                    { label: 'Protein', value: totals.protein, unit: 'g', color: '#00FFCC' },
                    { label: 'Carbs', value: totals.carbs, unit: 'g', color: '#6B8AFF' },
                    { label: 'Fats', value: totals.fat, unit: 'g', color: '#FFB86B' },
                  ].map((m) => (
                    <div key={m.label} className="flex flex-col items-center flex-1">
                      <span className="text-sm font-bold tabular-nums" style={{ color: ghostMode ? 'rgba(200,200,200,0.6)' : m.color }}>{m.value}{m.unit}</span>
                      <span className="text-[8px] uppercase tracking-wider" style={{ color: `${neon}0.35)` }}>{m.label}</span>
                    </div>
                  ))}
                </div>
                <MicroMatchBar percentage={dailyMicroMatch} ghostMode={ghostMode} neon={neon} />
              </div>
            </div>
          )}
        </div>
      </GlowCard>

      {/* ── Quick Log Input (persists to foodLogs; pending when AI off) ── */}
      <GlowCard className="p-1" glowRadius={300}>
        <div className="relative flex items-center gap-2 rounded-lg p-1" style={{ background: 'rgba(5,5,5,0.6)' }}>
          <div className="absolute -inset-[1px] rounded-xl pointer-events-none" style={{ background: isProcessing ? `linear-gradient(135deg, ${ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(0,255,204,0.4)'}, ${ghostMode ? 'rgba(120,120,120,0.1)' : 'rgba(0,255,204,0.05)'}, ${ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(0,255,204,0.4)'})` : 'none', backgroundSize: '200% 200%', animation: isProcessing ? 'borderGlow 1.5s ease-in-out infinite' : 'none', zIndex: -1 }} />
          <div className="flex-1 relative">
            <input ref={inputRef} type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} disabled={isProcessing} placeholder='Type meal text… e.g. "steak and espresso"' className="w-full bg-transparent px-4 py-3 text-sm outline-none placeholder:opacity-30" style={{ color: ghostMode ? 'rgba(200,200,200,0.8)' : 'rgba(255,255,255,0.85)', caretColor: ghostMode ? 'rgba(160,160,160,0.6)' : '#00FFCC' }} />
            <div className="absolute bottom-0 left-4 right-4 h-px" style={{ background: inputValue ? (ghostMode ? 'linear-gradient(90deg, transparent, rgba(160,160,160,0.2), transparent)' : 'linear-gradient(90deg, transparent, rgba(0,255,204,0.25), transparent)') : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)', transition: 'background 0.3s ease' }} />
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handlePhotoCapture(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={isProcessing}
            title="Store photo only (no AI macros)"
            className="relative flex items-center justify-center w-10 h-10 rounded-lg text-sm transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: `${neon}0.7)`,
              opacity: isProcessing ? 0.5 : 1,
            }}
          >
            📷
          </button>
          <button onClick={handleLogMeal} disabled={!inputValue.trim() || isProcessing} className="relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs uppercase tracking-wider transition-all duration-300 overflow-hidden" style={{ background: !inputValue.trim() ? 'rgba(255,255,255,0.02)' : ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(0,255,204,0.1)', color: !inputValue.trim() ? 'rgba(255,255,255,0.15)' : ghostMode ? 'rgba(200,200,200,0.7)' : 'rgba(0,255,204,0.9)', border: `1px solid ${!inputValue.trim() ? 'rgba(255,255,255,0.03)' : ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(0,255,204,0.2)'}`, boxShadow: inputValue.trim() && !ghostMode ? '0 0 15px rgba(0,255,204,0.1), inset 0 0 15px rgba(0,255,204,0.03)' : 'none', opacity: isProcessing ? 0.6 : 1 }}>
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: ghostMode ? 'rgba(160,160,160,0.4) transparent rgba(160,160,160,0.4) rgba(160,160,160,0.4)' : 'rgba(0,255,204,0.6) transparent rgba(0,255,204,0.6) rgba(0,255,204,0.6)' }} />
                Saving
              </span>
            ) : 'Save text'}
          </button>
        </div>
        <p className="px-3 pb-2 pt-1 text-[9px]" style={{ color: `${neon}0.3)` }}>
          Saves to foodLogs under your twin session. Without Shipper AI: pending analysis — no invented calories/macros.
        </p>
      </GlowCard>

      {/* ── Macro Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {macros.map((m) => (
          <MacroCard key={m.label} label={m.label} current={m.current} target={m.target} unit={m.unit} color={m.color} ghostMode={ghostMode} neon={neon} animateKey={animateKey} />
        ))}
      </div>

      {/* ── Meal Log Timeline ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: `${neon}0.35)` }}>Meal Log</span>
          {meals.length > 0 && (
            <span className="text-[10px] tabular-nums" style={{ color: `${neon}0.25)` }}>{meals.length} {meals.length === 1 ? 'entry' : 'entries'}</span>
          )}
        </div>

        <AnimatePresence mode="popLayout">
          {meals.length === 0 && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <GlowCard className="p-8" glowRadius={200}>
                <div className="flex flex-col items-center gap-3">
                  <span className="text-3xl" style={{ opacity: 0.3, filter: ghostMode ? 'grayscale(1)' : 'none' }}>{'\u25C9'}</span>
                  <span className="text-xs text-center" style={{ color: `${neon}0.3)` }}>No meals logged yet. Use "Log with Vive" or type above.</span>
                  <div className="flex gap-2 flex-wrap justify-center mt-1">
                    {['grilled chicken salad', 'protein shake', 'oatmeal with berries'].map((hint) => (
                      <button
                        key={hint}
                        onClick={() => { setInputValue(hint); inputRef.current?.focus(); }}
                        className="text-[9px] px-3 py-1 rounded-full border transition-all duration-200"
                        style={{ color: `${neon}0.4)`, borderColor: `${neon}0.08)`, background: `${neon}0.03)` }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.borderColor = ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(0,255,204,0.2)'; (e.target as HTMLElement).style.background = ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(0,255,204,0.06)'; }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.borderColor = `${neon}0.08)`; (e.target as HTMLElement).style.background = `${neon}0.03)`; }}
                      >
                        {hint}
                      </button>
                    ))}
                  </div>
                </div>
              </GlowCard>
            </motion.div>
          )}

          {meals.map((meal) => (
            <motion.div key={meal.id} layout initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}>
              <GlowCard className="p-4" glowRadius={200}>
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1.5 min-w-[44px]">
                    <span className="text-[10px] tabular-nums" style={{ color: `${neon}0.5)` }}>{meal.time}</span>
                    <div className="w-2 h-2 rounded-full" style={{ background: ghostMode ? 'rgba(160,160,160,0.3)' : meal.source === 'Voice' ? '#AF82FF' : meal.source === 'Photo' ? '#30D158' : '#00FFCC', boxShadow: ghostMode ? 'none' : justAdded === meal.id ? `0 0 12px ${meal.source === 'Voice' ? 'rgba(175,130,255,0.8)' : 'rgba(0,255,204,0.8)'}` : `0 0 6px ${meal.source === 'Voice' ? 'rgba(175,130,255,0.4)' : 'rgba(0,255,204,0.4)'}`, transition: 'box-shadow 0.5s ease' }} />
                    {meal.source && (
                      <span className="text-[7px] uppercase tracking-wider" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : meal.source === 'Voice' ? 'rgba(175,130,255,0.5)' : meal.source === 'Photo' ? 'rgba(48,209,88,0.5)' : 'rgba(0,255,204,0.4)' }}>
                        {meal.source === 'Voice' ? '\uD83C\uDF99' : meal.source === 'Photo' ? '\uD83D\uDCF8' : '\u2328\uFE0F'}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold truncate" style={{ color: ghostMode ? 'rgba(200,200,200,0.6)' : 'rgba(255,255,255,0.75)' }}>{meal.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {meal.analysisStatus !== 'pending' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: ghostMode ? 'rgba(160,160,160,0.6)' : meal.fuelScore >= 7 ? '#30D158' : meal.fuelScore >= 5 ? '#FBBF24' : '#FF6B6B', background: ghostMode ? 'rgba(160,160,160,0.06)' : meal.fuelScore >= 7 ? 'rgba(48,209,88,0.1)' : meal.fuelScore >= 5 ? 'rgba(251,191,36,0.1)' : 'rgba(255,107,107,0.1)', border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : meal.fuelScore >= 7 ? 'rgba(48,209,88,0.2)' : meal.fuelScore >= 5 ? 'rgba(251,191,36,0.2)' : 'rgba(255,107,107,0.2)'}` }}>{'\u26A1'}{meal.fuelScore}</span>
                        )}
                        <span className="text-[10px] tabular-nums" style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : meal.analysisStatus === 'pending' ? 'rgba(251,191,36,0.7)' : 'rgba(0,255,204,0.6)' }}>
                          {meal.analysisStatus === 'pending' ? 'Pending' : `${meal.calories} kcal`}
                        </span>
                      </div>
                    </div>
                    {meal.analysisStatus === 'pending' ? (
                      <div className="mt-2 flex flex-col gap-2">
                        <span className="text-[10px] px-2 py-1 rounded-md w-fit" style={{
                          color: '#FBBF24',
                          background: 'rgba(251,191,36,0.08)',
                          border: '1px solid rgba(251,191,36,0.2)',
                        }}>
                          Pending analysis — no macros claimed
                        </span>
                        {manualEditId === meal.id ? (
                          <div className="flex flex-wrap gap-2 items-center">
                            {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
                              <input
                                key={k}
                                type="number"
                                inputMode="decimal"
                                placeholder={k.slice(0, 3).toUpperCase()}
                                value={manualMacros[k]}
                                onChange={(e) => setManualMacros((m) => ({ ...m, [k]: e.target.value }))}
                                className="w-16 bg-black/40 border border-white/10 rounded px-2 py-1 text-[10px] text-white/80 outline-none"
                              />
                            ))}
                            <button
                              type="button"
                              onClick={() => void handleManualSave(meal)}
                              className="text-[9px] px-2 py-1 rounded border uppercase tracking-wider"
                              style={{ color: '#00FFCC', borderColor: 'rgba(0,255,204,0.25)' }}
                            >
                              Save macros
                            </button>
                            <button
                              type="button"
                              onClick={() => setManualEditId(null)}
                              className="text-[9px] text-white/30"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setManualEditId(meal.id);
                              setManualMacros({ calories: '', protein: '', carbs: '', fat: '' });
                            }}
                            className="text-[9px] px-2 py-1 rounded border w-fit uppercase tracking-wider"
                            style={{ color: `${neon}0.6)`, borderColor: `${neon}0.15)` }}
                          >
                            Enter macros manually
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <MacroPill label="P" value={`${meal.protein}g`} color="#00FFCC" ghostMode={ghostMode} />
                        <MacroPill label="C" value={`${meal.carbs}g`} color="#6B8AFF" ghostMode={ghostMode} />
                        <MacroPill label="F" value={`${meal.fat}g`} color="#FFB86B" ghostMode={ghostMode} />
                      </div>
                    )}
                  </div>
                </div>
              </GlowCard>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <style>{`
        @keyframes borderGlow {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes viveShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* Quick Fuel FAB — same pending-honest path when Shipper AI unset */}
      <QuickFuel />
    </div>
  );
}

/* ── Macro Pill ── */
function MacroPill({ label, value, color, ghostMode }: { label: string; value: string; color: string; ghostMode: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border" style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : `${color}CC`, borderColor: ghostMode ? 'rgba(160,160,160,0.08)' : `${color}18`, background: ghostMode ? 'rgba(160,160,160,0.03)' : `${color}08` }}>
      <span style={{ opacity: 0.6 }}>{label}</span>
      <span className="tabular-nums font-semibold">{value}</span>
    </span>
  );
}

export default NutritionView;
