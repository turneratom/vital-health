import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGhostMode } from '@/components/Presence/usePresenceState';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';

const SESSION_ID = 'vive-local-session';

const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Chest', icon: '\uD83E\uDEC1', color: '#FF6B6B', region: 'upper' },
  { id: 'back', label: 'Back', icon: '\uD83D\uDD19', color: '#4ECDC4', region: 'upper' },
  { id: 'shoulders', label: 'Shoulders', icon: '\uD83C\uDFD4\uFE0F', color: '#45B7D1', region: 'upper' },
  { id: 'biceps', label: 'Biceps', icon: '\uD83D\uDCAA', color: '#F7DC6F', region: 'upper' },
  { id: 'triceps', label: 'Triceps', icon: '\uD83E\uDDBE', color: '#BB8FCE', region: 'upper' },
  { id: 'core', label: 'Core', icon: '\uD83C\uDFAF', color: '#FF9500', region: 'mid' },
  { id: 'quads', label: 'Quads', icon: '\uD83E\uDDB5', color: '#00FFCC', region: 'lower' },
  { id: 'hamstrings', label: 'Hamstrings', icon: '\uD83E\uDDBF', color: '#2ECC71', region: 'lower' },
  { id: 'glutes', label: 'Glutes', icon: '\uD83C\uDF51', color: '#E74C3C', region: 'lower' },
  { id: 'calves', label: 'Calves', icon: '\uD83E\uDDB6', color: '#3498DB', region: 'lower' },
  { id: 'hip-flexors', label: 'Hip Flexors', icon: '\uD83D\uDD04', color: '#E67E22', region: 'lower' },
] as const;

const stagger = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

function getTierStyle(tier: string, gm: boolean) {
  if (gm) return { bg: 'rgba(160,160,160,0.08)', border: 'rgba(160,160,160,0.15)', text: 'rgba(200,200,200,0.7)' };
  switch (tier) {
    case 'recovery': return { bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)', text: '#A78BFA' };
    case 'light': return { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)', text: '#FBBF24' };
    case 'moderate': return { bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)', text: '#34D399' };
    case 'intense': return { bg: 'rgba(255,107,107,0.1)', border: 'rgba(255,107,107,0.3)', text: '#FF6B6B' };
    default: return { bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)', text: '#34D399' };
  }
}

function getCatStyle(cat: string, gm: boolean) {
  if (gm) return { bg: 'rgba(160,160,160,0.06)', text: 'rgba(160,160,160,0.5)' };
  switch (cat) {
    case 'strength': return { bg: 'rgba(255,107,107,0.08)', text: '#FF6B6B' };
    case 'cardio': return { bg: 'rgba(0,255,204,0.08)', text: '#00FFCC' };
    case 'mobility': return { bg: 'rgba(139,92,246,0.08)', text: '#A78BFA' };
    case 'recovery': return { bg: 'rgba(52,211,153,0.08)', text: '#34D399' };
    case 'hybrid': return { bg: 'rgba(251,191,36,0.08)', text: '#FBBF24' };
    case 'plyometric': return { bg: 'rgba(255,149,0,0.08)', text: '#FF9500' };
    default: return { bg: 'rgba(100,100,100,0.08)', text: '#999' };
  }
}

function DifficultyDots({ level, gm }: { level: string; gm: boolean }) {
  const n = level === 'beginner' ? 1 : level === 'intermediate' ? 2 : 3;
  const c = gm ? 'rgba(160,160,160,0.4)' : n === 1 ? '#34D399' : n === 2 ? '#FBBF24' : '#FF6B6B';
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i <= n ? c : gm ? 'rgba(160,160,160,0.1)' : 'rgba(255,255,255,0.08)' }} />
      ))}
    </div>
  );
}

function SuitabilityBar({ value, gm }: { value: number; gm: boolean }) {
  const c = gm ? 'rgba(160,160,160,0.4)' : value >= 75 ? '#34D399' : value >= 50 ? '#FBBF24' : '#FF6B6B';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 rounded-full flex-1" style={{ background: gm ? 'rgba(160,160,160,0.08)' : 'rgba(255,255,255,0.06)' }}>
        <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }} style={{ background: c, boxShadow: gm ? 'none' : `0 0 8px ${c}40` }} />
      </div>
      <span className="text-[10px] tabular-nums font-medium" style={{ color: c }}>{value}%</span>
    </div>
  );
}

function MuscleMap({ selectedMuscles, fatigueMap, onToggle, gm }: { selectedMuscles: string[]; fatigueMap: Record<string, { lastTrained: number; intensity: string }>; onToggle: (id: string) => void; gm: boolean }) {
  const now = Date.now();
  return (
    <div className="grid grid-cols-4 gap-2">
      {MUSCLE_GROUPS.map((mg) => {
        const sel = selectedMuscles.includes(mg.id);
        const fat = fatigueMap[mg.id];
        const hrs = fat ? (now - fat.lastTrained) / 3600000 : 999;
        const fatigued = hrs < 48;
        const fatLvl = hrs < 24 ? 'high' : 'moderate';
        return (
          <motion.button key={mg.id} whileTap={{ scale: 0.93 }} onClick={() => onToggle(mg.id)} className="relative flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition-all duration-200" style={{ background: sel ? (gm ? 'rgba(160,160,160,0.12)' : `${mg.color}12`) : (gm ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.03)'), border: `1.5px solid ${sel ? (gm ? 'rgba(160,160,160,0.25)' : `${mg.color}40`) : 'rgba(255,255,255,0.06)'}`, boxShadow: sel && !gm ? `0 0 16px ${mg.color}15` : 'none' }}>
            {fatigued && <div className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: fatLvl === 'high' ? (gm ? 'rgba(160,160,160,0.5)' : '#FF6B6B') : (gm ? 'rgba(160,160,160,0.3)' : '#FBBF24'), boxShadow: gm ? 'none' : fatLvl === 'high' ? '0 0 6px rgba(255,107,107,0.5)' : '0 0 6px rgba(251,191,36,0.4)' }} />}
            <span className="text-lg">{mg.icon}</span>
            <span className="text-[9px] font-medium tracking-wide leading-none text-center" style={{ color: sel ? (gm ? 'rgba(160,160,160,0.5)' : mg.color) : (gm ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.4)') }}>{mg.label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

function ExerciseCard({ exercise, isIn, onToggle, gm }: { exercise: any; isIn: boolean; onToggle: () => void; gm: boolean }) {
  const cs = getCatStyle(exercise.category, gm);
  return (
    <motion.div layout variants={fadeUp} className="relative rounded-xl p-3 transition-all duration-200" style={{ background: isIn ? (gm ? 'rgba(160,160,160,0.08)' : 'rgba(52,211,153,0.06)') : (gm ? 'rgba(160,160,160,0.03)' : 'rgba(255,255,255,0.025)'), border: `1px solid ${isIn ? (gm ? 'rgba(160,160,160,0.2)' : 'rgba(52,211,153,0.25)') : 'rgba(255,255,255,0.06)'}` }}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: gm ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${gm ? 'rgba(160,160,160,0.1)' : 'rgba(255,255,255,0.06)'}` }}>{exercise.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold leading-tight truncate" style={{ color: gm ? 'rgba(220,220,220,0.85)' : 'rgba(255,255,255,0.9)' }}>{exercise.name}</span>
            <DifficultyDots level={exercise.difficulty} gm={gm} />
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: cs.bg, color: cs.text }}>{exercise.category}</span>
            <span className="text-[10px]" style={{ color: gm ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.3)' }}>{exercise.defaultSets}x{exercise.defaultReps}</span>
            <span className="text-[10px]" style={{ color: gm ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.3)' }}>{exercise.equipment}</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {exercise.muscleGroups.slice(0, 3).map((mg: string) => {
              const meta = MUSCLE_GROUPS.find((m) => m.id === mg);
              return <span key={mg} className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ background: gm ? 'rgba(160,160,160,0.06)' : `${meta?.color || '#666'}10`, color: gm ? 'rgba(160,160,160,0.4)' : `${meta?.color || '#666'}90` }}>{meta?.label || mg}</span>;
            })}
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.85 }} onClick={onToggle} className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200" style={{ background: isIn ? (gm ? 'rgba(160,160,160,0.12)' : 'rgba(52,211,153,0.15)') : (gm ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.05)'), border: `1px solid ${isIn ? (gm ? 'rgba(160,160,160,0.2)' : 'rgba(52,211,153,0.3)') : 'rgba(255,255,255,0.08)'}` }}>
          <span style={{ color: isIn ? (gm ? 'rgba(160,160,160,0.6)' : '#34D399') : (gm ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.4)') }}>{isIn ? '\u2713' : '+'}</span>
        </motion.button>
      </div>
    </motion.div>
  );
}

function RoutineCard({ routine, onSelect, gm, isRec }: { routine: any; onSelect: () => void; gm: boolean; isRec?: boolean }) {
  const cs = getCatStyle(routine.category, gm);
  return (
    <motion.button variants={fadeUp} whileTap={{ scale: 0.97 }} onClick={onSelect} className="relative w-full text-left rounded-2xl p-4 transition-all duration-200" style={{ background: gm ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.025)', border: `1.5px solid ${isRec ? (gm ? 'rgba(160,160,160,0.2)' : 'rgba(52,211,153,0.25)') : 'rgba(255,255,255,0.06)'}`, boxShadow: isRec && !gm ? '0 0 20px rgba(52,211,153,0.08)' : 'none' }}>
      {isRec && <div className="absolute -top-2 right-3 px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider" style={{ background: gm ? 'rgba(160,160,160,0.15)' : 'rgba(52,211,153,0.15)', color: gm ? 'rgba(200,200,200,0.7)' : '#34D399', border: `1px solid ${gm ? 'rgba(160,160,160,0.2)' : 'rgba(52,211,153,0.3)'}` }}>RECOMMENDED</div>}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl" style={{ background: gm ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)', border: `1px solid ${gm ? 'rgba(160,160,160,0.1)' : 'rgba(255,255,255,0.06)'}` }}>{routine.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold leading-tight" style={{ color: gm ? 'rgba(220,220,220,0.85)' : 'rgba(255,255,255,0.9)' }}>{routine.name}</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: cs.bg, color: cs.text }}>{routine.category}</span>
          </div>
          <p className="text-[11px] mt-1" style={{ color: gm ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{routine.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] font-medium" style={{ color: gm ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.3)' }}>{"\u23F1"} {routine.estimatedDuration}min</span>
            <span className="text-[10px] font-medium" style={{ color: gm ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.3)' }}>{"\uD83D\uDD25"} ~{routine.estimatedCalories}cal</span>
            <DifficultyDots level={routine.difficulty} gm={gm} />
          </div>
          {routine.suitability !== undefined && <div className="mt-2"><SuitabilityBar value={routine.suitability} gm={gm} /></div>}
        </div>
        <div className="flex-shrink-0 self-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke={gm ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.2)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      </div>
    </motion.button>
  );
}

type Tab = 'smart' | 'library' | 'builder';

export function RoutineBuilder() {
  const gm = useGhostMode();
  const [activeTab, setActiveTab] = useState<Tab>('smart');
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [routineExercises, setRoutineExercises] = useState<string[]>([]);
  const [routineName, setRoutineName] = useState('');
  const [libraryFilter, setLibraryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [loggedToast, setLoggedToast] = useState(false);

  const recs = useQuery(api.trainer.getSmartRecommendations, { sessionId: SESSION_ID });
  const exercises = useQuery(api.trainer.getExerciseLibrary);
  const logRoutine = useMutation(api.trainer.logRoutineAsWorkout);

  const fatigueMap = recs?.fatigueMap ?? {};

  const toggleMuscle = useCallback((id: string) => {
    setSelectedMuscles((p) => p.includes(id) ? p.filter((m) => m !== id) : [...p, id]);
  }, []);

  const toggleExercise = useCallback((id: string) => {
    setRoutineExercises((p) => p.includes(id) ? p.filter((e) => e !== id) : [...p, id]);
  }, []);

  const loadTemplate = useCallback((t: any) => {
    setRoutineExercises(t.exerciseIds || []);
    setRoutineName(t.name);
    setActiveTab('builder');
  }, []);

  const filtered = useMemo(() => {
    if (!exercises) return [];
    let f = [...exercises] as any[];
    if (selectedMuscles.length > 0) f = f.filter((e) => e.muscleGroups.some((mg: string) => selectedMuscles.includes(mg)));
    if (libraryFilter !== 'all') f = f.filter((e) => e.category === libraryFilter);
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); f = f.filter((e) => e.name.toLowerCase().includes(q) || e.muscleGroups.some((mg: string) => mg.includes(q)) || e.tags.some((t: string) => t.includes(q))); }
    return f;
  }, [exercises, selectedMuscles, libraryFilter, searchQuery]);

  const routineDetails = useMemo(() => {
    if (!exercises) return [];
    return routineExercises.map((id) => (exercises as any[]).find((e) => e.id === id)).filter(Boolean);
  }, [exercises, routineExercises]);

  const stats = useMemo(() => {
    const muscles = new Set<string>();
    let cal = 0, dur = 0;
    for (const ex of routineDetails) {
      if (!ex) continue;
      for (const mg of ex.muscleGroups) muscles.add(mg);
      cal += ex.caloriesPer10Min * 5;
      dur += 5 + (ex.defaultSets - 1) * (ex.defaultRest / 60);
    }
    return { muscles: Array.from(muscles), calories: Math.round(cal), duration: Math.round(dur), count: routineDetails.length };
  }, [routineDetails]);

  const handleLog = useCallback(async () => {
    if (routineExercises.length === 0) return;
    try {
      await logRoutine({ sessionId: SESSION_ID, routineName: routineName || 'Custom Routine', muscleGroups: stats.muscles, duration: stats.duration, intensity: stats.count > 5 ? 'high' : stats.count > 3 ? 'moderate' : 'light', exerciseIds: routineExercises });
      setLoggedToast(true);
      setShowConfirm(false);
      setTimeout(() => setLoggedToast(false), 3000);
    } catch (err) { console.error('Failed to log:', err); }
  }, [logRoutine, routineExercises, routineName, stats]);

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'smart', label: 'Smart', icon: '\uD83E\uDDE0' },
    { id: 'library', label: 'Library', icon: '\uD83D\uDCDA' },
    { id: 'builder', label: 'Builder', icon: '\uD83D\uDD27' },
  ];

  const ts = getTierStyle(recs?.tier || 'moderate', gm);

  return (
    <div className="flex flex-col gap-4 pb-32">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight" style={{ color: gm ? 'rgba(220,220,220,0.85)' : 'rgba(255,255,255,0.95)' }}>Vive Trainer</h2>
          <p className="text-[11px] mt-0.5" style={{ color: gm ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>Intelligent routines mapped to your recovery</p>
        </div>
        {recs && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: ts.bg, border: `1px solid ${ts.border}` }}>
            <span className="text-[10px] font-semibold tracking-wider" style={{ color: ts.text }}>{recs.advisoryIcon} SCORE {recs.score}</span>
          </motion.div>
        )}
      </motion.div>

      {/* Tab Bar */}
      <div className="flex rounded-xl p-1 gap-1" style={{ background: gm ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.03)', border: `1px solid ${gm ? 'rgba(160,160,160,0.08)' : 'rgba(255,255,255,0.06)'}` }}>
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12px] font-semibold tracking-wide transition-all duration-200" style={{ background: activeTab === tab.id ? (gm ? 'rgba(160,160,160,0.1)' : 'rgba(52,211,153,0.1)') : 'transparent', color: activeTab === tab.id ? (gm ? 'rgba(220,220,220,0.85)' : '#34D399') : (gm ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.35)'), border: activeTab === tab.id ? `1px solid ${gm ? 'rgba(160,160,160,0.15)' : 'rgba(52,211,153,0.2)'}` : '1px solid transparent' }}>
            <span className="text-sm">{tab.icon}</span>
            {tab.label}
            {tab.id === 'builder' && routineExercises.length > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: gm ? 'rgba(160,160,160,0.2)' : 'rgba(52,211,153,0.2)', color: gm ? 'rgba(200,200,200,0.7)' : '#34D399' }}>{routineExercises.length}</span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* SMART TAB */}
        {activeTab === 'smart' && (
          <motion.div key="smart" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="flex flex-col gap-4">
            {recs && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-4" style={{ background: gm ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.025)', border: `1.5px solid ${ts.border}`, boxShadow: gm ? 'none' : `0 0 24px ${ts.text}10` }}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: ts.bg, border: `1px solid ${ts.border}` }}>{recs.advisoryIcon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color: ts.text }}>{recs.tier} Mode</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: ts.bg, color: ts.text }}>{recs.recentWorkoutCount} workouts / 72h</span>
                    </div>
                    <p className="text-[12px]" style={{ color: gm ? 'rgba(160,160,160,0.5)' : 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{recs.advisory}</p>
                  </div>
                </div>
              </motion.div>
            )}
            <div>
              <h3 className="text-[12px] font-semibold tracking-wider uppercase mb-3" style={{ color: gm ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.35)' }}>Recommended for You</h3>
              <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-3">
                {(recs?.recommended || []).map((r: any, i: number) => <RoutineCard key={r.id} routine={r} onSelect={() => loadTemplate(r)} gm={gm} isRec={i === 0} />)}
              </motion.div>
            </div>
            <div>
              <h3 className="text-[12px] font-semibold tracking-wider uppercase mb-3" style={{ color: gm ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.35)' }}>All Routines</h3>
              <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-3">
                {(recs?.allRoutines || []).slice(3).map((r: any) => <RoutineCard key={r.id} routine={r} onSelect={() => loadTemplate(r)} gm={gm} />)}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* LIBRARY TAB */}
        {activeTab === 'library' && (
          <motion.div key="library" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: gm ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.03)', border: `1px solid ${gm ? 'rgba(160,160,160,0.1)' : 'rgba(255,255,255,0.06)'}` }}>
              <span style={{ color: gm ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.25)' }}>{"\uD83D\uDD0D"}</span>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search exercises..." className="flex-1 bg-transparent text-[13px] outline-none placeholder:opacity-30" style={{ color: gm ? 'rgba(220,220,220,0.85)' : 'rgba(255,255,255,0.85)' }} />
              {searchQuery && <button onClick={() => setSearchQuery('')}><span className="text-[10px]" style={{ color: gm ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.3)' }}>{"\u2715"}</span></button>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[11px] font-semibold tracking-wider uppercase" style={{ color: gm ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.35)' }}>Filter by Muscle</h3>
                {selectedMuscles.length > 0 && <button onClick={() => setSelectedMuscles([])} className="text-[10px] font-medium" style={{ color: gm ? 'rgba(160,160,160,0.4)' : 'rgba(52,211,153,0.6)' }}>Clear</button>}
              </div>
              <MuscleMap selectedMuscles={selectedMuscles} fatigueMap={fatigueMap} onToggle={toggleMuscle} gm={gm} />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {['all', 'strength', 'cardio', 'mobility', 'recovery', 'plyometric'].map((cat) => {
                const active = libraryFilter === cat;
                const s = cat === 'all' ? { bg: active ? (gm ? 'rgba(160,160,160,0.1)' : 'rgba(255,255,255,0.08)') : 'transparent', text: active ? (gm ? 'rgba(220,220,220,0.85)' : 'rgba(255,255,255,0.8)') : (gm ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.3)') } : getCatStyle(cat, gm);
                return <button key={cat} onClick={() => setLibraryFilter(cat)} className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-semibold tracking-wider uppercase transition-all duration-200" style={{ background: active ? (cat === 'all' ? s.bg : `${s.text}15`) : 'transparent', color: active ? s.text : (gm ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.3)'), border: `1px solid ${active ? `${s.text}30` : 'transparent'}` }}>{cat}</button>;
              })}
            </div>
            <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-2">
              {filtered.length === 0 ? (
                <div className="text-center py-8">
                  <span className="text-2xl mb-2 block">{"\uD83C\uDFCB\uFE0F"}</span>
                  <p className="text-[12px]" style={{ color: gm ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.35)' }}>No exercises match your filters</p>
                </div>
              ) : filtered.map((ex: any) => <ExerciseCard key={ex.id} exercise={ex} isIn={routineExercises.includes(ex.id)} onToggle={() => toggleExercise(ex.id)} gm={gm} />)}
            </motion.div>
          </motion.div>
        )}

        {/* BUILDER TAB */}
        {activeTab === 'builder' && (
          <motion.div key="builder" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="flex flex-col gap-4">
            <div className="rounded-xl px-4 py-3" style={{ background: gm ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.025)', border: `1px solid ${gm ? 'rgba(160,160,160,0.1)' : 'rgba(255,255,255,0.06)'}` }}>
              <input type="text" value={routineName} onChange={(e) => setRoutineName(e.target.value)} placeholder="Name your routine..." className="w-full bg-transparent text-[15px] font-semibold outline-none placeholder:opacity-25" style={{ color: gm ? 'rgba(220,220,220,0.85)' : 'rgba(255,255,255,0.9)' }} />
            </div>

            {routineExercises.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid grid-cols-3 gap-2">
                {[{ label: 'Exercises', value: String(stats.count), icon: '\uD83C\uDFCB\uFE0F' }, { label: 'Duration', value: `${stats.duration}m`, icon: '\u23F1' }, { label: 'Calories', value: `~${stats.calories}`, icon: '\uD83D\uDD25' }].map((s) => (
                  <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: gm ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.025)', border: `1px solid ${gm ? 'rgba(160,160,160,0.08)' : 'rgba(255,255,255,0.06)'}` }}>
                    <span className="text-sm block">{s.icon}</span>
                    <span className="text-[16px] font-bold tabular-nums block mt-0.5" style={{ color: gm ? 'rgba(200,200,200,0.7)' : 'rgba(255,255,255,0.85)' }}>{s.value}</span>
                    <span className="text-[9px] font-medium tracking-wider uppercase" style={{ color: gm ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.3)' }}>{s.label}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {stats.muscles.length > 0 && (
              <div>
                <h3 className="text-[11px] font-semibold tracking-wider uppercase mb-2" style={{ color: gm ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.35)' }}>Muscle Coverage</h3>
                <div className="flex flex-wrap gap-1.5">
                  {stats.muscles.map((mg) => {
                    const meta = MUSCLE_GROUPS.find((m) => m.id === mg);
                    return <span key={mg} className="text-[10px] font-medium px-2 py-1 rounded-lg" style={{ background: gm ? 'rgba(160,160,160,0.08)' : `${meta?.color || '#666'}12`, color: gm ? 'rgba(160,160,160,0.5)' : meta?.color || '#666', border: `1px solid ${gm ? 'rgba(160,160,160,0.12)' : `${meta?.color || '#666'}25`}` }}>{meta?.icon} {meta?.label || mg}</span>;
                  })}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-[11px] font-semibold tracking-wider uppercase mb-2" style={{ color: gm ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.35)' }}>Exercises ({routineExercises.length})</h3>
              {routineExercises.length === 0 ? (
                <div className="rounded-2xl p-8 text-center" style={{ background: gm ? 'rgba(160,160,160,0.03)' : 'rgba(255,255,255,0.02)', border: `1.5px dashed ${gm ? 'rgba(160,160,160,0.1)' : 'rgba(255,255,255,0.08)'}` }}>
                  <span className="text-3xl block mb-2">{"\uD83D\uDD27"}</span>
                  <p className="text-[13px] font-medium mb-1" style={{ color: gm ? 'rgba(160,160,160,0.5)' : 'rgba(255,255,255,0.45)' }}>No exercises added yet</p>
                  <p className="text-[11px]" style={{ color: gm ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>Choose a Smart recommendation or browse the Library</p>
                  <button onClick={() => setActiveTab('library')} className="mt-3 px-4 py-2 rounded-xl text-[11px] font-semibold tracking-wide transition-all duration-200" style={{ background: gm ? 'rgba(160,160,160,0.08)' : 'rgba(52,211,153,0.1)', color: gm ? 'rgba(200,200,200,0.7)' : '#34D399', border: `1px solid ${gm ? 'rgba(160,160,160,0.15)' : 'rgba(52,211,153,0.25)'}` }}>Browse Library {"\u2192"}</button>
                </div>
              ) : (
                <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-2">
                  {routineDetails.map((ex: any) => <ExerciseCard key={ex.id} exercise={ex} isIn={true} onToggle={() => toggleExercise(ex.id)} gm={gm} />)}
                </motion.div>
              )}
            </div>

            {routineExercises.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="sticky bottom-24 z-30">
                <AnimatePresence mode="wait">
                  {showConfirm ? (
                    <motion.div key="confirm" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="rounded-2xl p-4" style={{ background: gm ? 'rgba(20,20,20,0.95)' : 'rgba(6,10,8,0.96)', border: `1.5px solid ${gm ? 'rgba(160,160,160,0.2)' : 'rgba(52,211,153,0.3)'}`, backdropFilter: 'blur(24px)', boxShadow: gm ? '0 -4px 24px rgba(0,0,0,0.5)' : '0 -4px 30px rgba(0,0,0,0.5), 0 0 40px rgba(52,211,153,0.1)' }}>
                      <p className="text-[13px] font-medium text-center mb-3" style={{ color: gm ? 'rgba(220,220,220,0.85)' : 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>Log &quot;{routineName || 'Custom Routine'}&quot; as completed?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold" style={{ background: gm ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.05)', color: gm ? 'rgba(160,160,160,0.5)' : 'rgba(255,255,255,0.4)', border: `1px solid ${gm ? 'rgba(160,160,160,0.1)' : 'rgba(255,255,255,0.08)'}` }}>Cancel</button>
                        <button onClick={handleLog} className="flex-1 py-2.5 rounded-xl text-[12px] font-bold tracking-wide" style={{ background: gm ? 'rgba(160,160,160,0.15)' : 'rgba(52,211,153,0.15)', color: gm ? 'rgba(220,220,220,0.85)' : '#34D399', border: `1px solid ${gm ? 'rgba(160,160,160,0.25)' : 'rgba(52,211,153,0.35)'}`, boxShadow: gm ? 'none' : '0 0 16px rgba(52,211,153,0.15)' }}>{"\u2713"} Log Workout</button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button key="start" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.97 }} onClick={() => setShowConfirm(true)} className="w-full py-3.5 rounded-2xl text-[14px] font-bold tracking-wide transition-all duration-300" style={{ background: gm ? 'rgba(160,160,160,0.1)' : 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(16,185,129,0.15))', color: gm ? 'rgba(220,220,220,0.85)' : '#34D399', border: `1.5px solid ${gm ? 'rgba(160,160,160,0.2)' : 'rgba(52,211,153,0.35)'}`, boxShadow: gm ? 'none' : '0 4px 24px rgba(52,211,153,0.15), 0 0 40px rgba(52,211,153,0.08)', backdropFilter: 'blur(16px)' }}>Start Routine {"\u2192"}</motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logged Toast */}
      <AnimatePresence>
        {loggedToast && (
          <motion.div initial={{ opacity: 0, y: -30, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.95 }} className="fixed top-20 left-0 right-0 z-[250] flex justify-center pointer-events-none px-4">
            <div className="pointer-events-auto rounded-2xl border px-5 py-3.5 flex items-center gap-3" style={{ background: gm ? 'rgba(20,20,20,0.95)' : 'rgba(6,10,8,0.96)', borderColor: gm ? 'rgba(160,160,160,0.15)' : 'rgba(52,211,153,0.3)', backdropFilter: 'blur(24px)', boxShadow: gm ? '0 4px 24px rgba(0,0,0,0.5)' : '0 4px 30px rgba(0,0,0,0.5), 0 0 40px rgba(52,211,153,0.12)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: gm ? 'rgba(160,160,160,0.1)' : 'rgba(52,211,153,0.12)', border: `1.5px solid ${gm ? 'rgba(160,160,160,0.2)' : 'rgba(52,211,153,0.35)'}` }}>
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>{"\u2713"}</motion.span>
              </div>
              <div>
                <span className="text-[13px] font-semibold tracking-wide block" style={{ color: gm ? 'rgba(220,220,220,0.85)' : '#34D399' }}>WORKOUT LOGGED</span>
                <span className="text-[10px] tracking-wider" style={{ color: gm ? 'rgba(160,160,160,0.4)' : 'rgba(52,211,153,0.45)' }}>Elite Score updating...</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
