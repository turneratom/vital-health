import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

import { getTwinSessionId } from '@/lib/twinSession'
/* ── Constants ── */
const CYAN = '#00F2FF';
const PURPLE = '#BF5AF2';
const CYAN_DIM = 'rgba(0,242,255,';
const PURPLE_DIM = 'rgba(191,90,242,';
const GOLD = '#FFD700';

/* ── Meal Recommendation Engine ── */
interface MealRecommendation {
  id: string;
  name: string;
  description: string;
  reason: string;
  tags: string[];
  protein: number;
  calories: number;
  icon: string;
  searchQuery: string;
  priority: 'top-pick' | 'great-choice' | 'solid-option';
}

interface BioNeeds {
  needsVitaminD: boolean;
  needsIron: boolean;
  needsAntiInflammatory: boolean;
  needsGlucoseControl: boolean;
  needsTestosterone: boolean;
  lowHRV: boolean;
  highStrain: boolean;
  preferredProteins: string[];
  restrictions: string[];
}

function analyzeBioNeeds(vault: any, vitals?: { hrv?: number; hrvAvg7d?: number; strain?: number }): BioNeeds {
  const prots = vault?.preferredProteins
    ? vault.preferredProteins.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
    : [];
  const rests = vault?.dietaryRestrictions
    ? vault.dietaryRestrictions.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  return {
    needsVitaminD: (vault?.vitaminD ?? 100) < 40,
    needsIron: (vault?.ferritin ?? 100) < 50,
    needsAntiInflammatory: (vault?.crp ?? 0) > 1.0,
    needsGlucoseControl: (vault?.hba1c ?? 0) > 5.4,
    needsTestosterone: (vault?.testosteroneTotal ?? 999) < 400,
    lowHRV: vitals?.hrv && vitals?.hrvAvg7d ? vitals.hrv < vitals.hrvAvg7d * 0.8 : false,
    highStrain: (vitals?.strain ?? 0) > 14,
    preferredProteins: prots,
    restrictions: rests,
  };
}

function generateRecommendations(needs: BioNeeds): MealRecommendation[] {
  const meals: MealRecommendation[] = [];
  const isRestricted = (keyword: string) => {
    const r = needs.restrictions;
    if (keyword === 'gluten' && r.some(x => x.includes('gluten'))) return true;
    if (keyword === 'dairy' && r.some(x => x.includes('dairy'))) return true;
    if (keyword === 'meat' && r.some(x => x.includes('vegan') || x.includes('plant'))) return true;
    return false;
  };
  const prefersProtein = (type: string) => needs.preferredProteins.length === 0 || needs.preferredProteins.some(p => p.includes(type));

  // Top-tier: Salmon — Vitamin D + Anti-inflammatory + Omega-3
  if ((needs.needsVitaminD || needs.needsAntiInflammatory || needs.lowHRV) && prefersProtein('salmon')) {
    meals.push({
      id: 'salmon-recovery',
      name: 'Wild Salmon Power Bowl',
      description: 'Grilled wild salmon over quinoa with roasted sweet potato, spinach, and avocado drizzle',
      reason: needs.needsVitaminD
        ? 'Your Vitamin D is below 40 ng/mL — salmon is the #1 natural source'
        : needs.lowHRV
        ? 'HRV is below your 7-day average — omega-3s support parasympathetic recovery'
        : 'CRP elevated — omega-3 fatty acids reduce systemic inflammation',
      tags: ['High Omega-3', 'Vitamin D', 'Anti-Inflammatory'],
      protein: 44,
      calories: 520,
      icon: '\uD83E\uDD69',
      searchQuery: 'grilled+salmon+bowl+quinoa',
      priority: 'top-pick',
    });
  }

  // High-protein recovery — post-strain
  if ((needs.highStrain || needs.needsTestosterone) && prefersProtein('beef') && !isRestricted('meat')) {
    meals.push({
      id: 'steak-recovery',
      name: 'Grass-Fed Steak & Greens',
      description: 'Grass-fed sirloin with sauteed kale, roasted garlic, and bone broth reduction',
      reason: needs.highStrain
        ? 'Strain above 14 — high-quality protein + iron for muscle repair'
        : 'Zinc and saturated fat from grass-fed beef support testosterone production',
      tags: ['High Protein', 'Iron-Rich', 'Muscle Recovery'],
      protein: 52,
      calories: 580,
      icon: '\uD83E\uDD69',
      searchQuery: 'grass+fed+steak+greens',
      priority: 'top-pick',
    });
  }

  // Iron-rich option
  if (needs.needsIron && !isRestricted('meat')) {
    meals.push({
      id: 'iron-boost',
      name: 'Spinach & Egg Power Plate',
      description: 'Three pasture-raised eggs over wilted spinach with lemon, hemp seeds, and vitamin C-rich bell peppers',
      reason: 'Ferritin below 50 — spinach + eggs + vitamin C maximizes iron absorption',
      tags: ['Iron-Rich', 'Vitamin C', 'Bioavailable'],
      protein: 28,
      calories: 380,
      icon: '\uD83E\uDD5A',
      searchQuery: 'spinach+egg+plate+healthy',
      priority: 'great-choice',
    });
  }

  // Glucose control
  if (needs.needsGlucoseControl) {
    meals.push({
      id: 'glucose-stable',
      name: 'Mediterranean Chicken Bowl',
      description: 'Herb-grilled chicken thigh with chickpeas, cucumber, olives, feta, and tahini dressing',
      reason: 'HbA1c above 5.4% — low-glycemic Mediterranean meals improve insulin sensitivity',
      tags: ['Low Glycemic', 'Fiber-Rich', 'Blood Sugar Stable'],
      protein: 38,
      calories: 450,
      icon: '\uD83C\uDF57',
      searchQuery: 'mediterranean+chicken+bowl+healthy',
      priority: 'great-choice',
    });
  }

  // Plant-based option
  if (prefersProtein('plant') || isRestricted('meat')) {
    meals.push({
      id: 'plant-power',
      name: 'Tempeh Buddha Bowl',
      description: 'Marinated tempeh with brown rice, edamame, roasted broccoli, avocado, and miso-ginger dressing',
      reason: 'Plant-based complete protein with all essential amino acids for recovery',
      tags: ['Plant Protein', 'Complete Amino', 'Anti-Inflammatory'],
      protein: 32,
      calories: 480,
      icon: '\uD83E\uDD66',
      searchQuery: 'tempeh+buddha+bowl+plant+based',
      priority: 'great-choice',
    });
  }

  // Anti-inflammatory recovery
  if (needs.needsAntiInflammatory || needs.lowHRV) {
    meals.push({
      id: 'anti-inflam',
      name: 'Turmeric Chicken & Sweet Potato',
      description: 'Golden turmeric-spiced chicken breast with mashed sweet potato and steamed broccoli',
      reason: needs.needsAntiInflammatory
        ? 'CRP elevated — curcumin in turmeric is a potent anti-inflammatory'
        : 'Low HRV recovery — anti-inflammatory foods support nervous system repair',
      tags: ['Anti-Inflammatory', 'Curcumin', 'Recovery'],
      protein: 42,
      calories: 460,
      icon: '\uD83C\uDF5B',
      searchQuery: 'turmeric+chicken+sweet+potato+healthy',
      priority: 'solid-option',
    });
  }

  // Keto option
  if (needs.restrictions.some(r => r.includes('keto'))) {
    meals.push({
      id: 'keto-plate',
      name: 'Keto Salmon Avocado Plate',
      description: 'Pan-seared salmon with avocado, macadamia nuts, arugula, and olive oil drizzle',
      reason: 'Keto-optimized — high healthy fats with zero net carbs for ketosis maintenance',
      tags: ['Keto', 'High Fat', 'Zero Carb'],
      protein: 38,
      calories: 620,
      icon: '\uD83E\uDD51',
      searchQuery: 'keto+salmon+avocado+plate',
      priority: 'great-choice',
    });
  }

  // Default fallback — always have at least one recommendation
  if (meals.length < 2) {
    meals.push({
      id: 'balanced-default',
      name: 'Grilled Chicken & Quinoa Bowl',
      description: 'Herb-marinated chicken breast with quinoa, roasted vegetables, and lemon-herb dressing',
      reason: 'Balanced macros with complete protein — ideal for sustained energy and recovery',
      tags: ['Balanced', 'High Protein', 'Clean Fuel'],
      protein: 42,
      calories: 480,
      icon: '\uD83C\uDF57',
      searchQuery: 'grilled+chicken+quinoa+bowl+healthy',
      priority: 'solid-option',
    });
  }

  if (meals.length < 3) {
    meals.push({
      id: 'smoothie-boost',
      name: 'Recovery Protein Smoothie',
      description: 'Whey protein, frozen berries, spinach, almond butter, and coconut water',
      reason: 'Quick-absorbing protein + antioxidants for post-workout recovery window',
      tags: ['Quick Fuel', 'Antioxidant', 'Post-Workout'],
      protein: 35,
      calories: 320,
      icon: '\uD83E\uDD64',
      searchQuery: 'protein+smoothie+berries+healthy',
      priority: 'solid-option',
    });
  }

  return meals.slice(0, 3);
}

/* ── Priority Badge ── */
function PriorityBadge({ priority, ghostMode }: { priority: string; ghostMode: boolean }) {
  const config = {
    'top-pick': { label: 'TOP PICK', color: GOLD, bg: 'rgba(255,215,0,0.08)', border: 'rgba(255,215,0,0.2)' },
    'great-choice': { label: 'GREAT CHOICE', color: '#30D158', bg: 'rgba(48,209,88,0.08)', border: 'rgba(48,209,88,0.2)' },
    'solid-option': { label: 'SOLID OPTION', color: CYAN, bg: `${CYAN_DIM}0.08)`, border: `${CYAN_DIM}0.2)` },
  }[priority] || { label: 'OPTION', color: CYAN, bg: `${CYAN_DIM}0.08)`, border: `${CYAN_DIM}0.2)` };

  return (
    <span
      className="text-[8px] font-mono font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full"
      style={{
        color: ghostMode ? 'rgba(160,160,160,0.5)' : config.color,
        background: ghostMode ? 'rgba(160,160,160,0.06)' : config.bg,
        border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : config.border}`,
      }}
    >
      {config.label}
    </span>
  );
}

/* ══════════════════════════════════════════════
   Vive Concierge — "What should I eat?"
   ══════════════════════════════════════════════ */
export function ViveConcierge({ ghostMode, planningMode = false, planningDate }: { ghostMode: boolean; planningMode?: boolean; planningDate?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<MealRecommendation[] | null>(null);

  // Fetch Bio-Vault data from Shipper Cloud
  let bioVaultData: any = null;
  try {
    const sessionId = typeof window !== 'undefined' ? (getTwinSessionId()) : 'default';
    bioVaultData = useQuery(api.queries.getBioVaultBySession, { sessionId });
  } catch {
    // Convex not connected — use defaults
  }

  const handleAsk = () => {
    if (isOpen && recommendations) {
      setIsOpen(false);
      setRecommendations(null);
      return;
    }
    setIsOpen(true);
    setIsLoading(true);

    // Simulate brief "thinking" delay for premium feel
    setTimeout(() => {
      const needs = analyzeBioNeeds(bioVaultData, {
        hrv: 48,
        hrvAvg7d: 58,
        strain: 15.2,
      });
      const recs = generateRecommendations(needs);
      setRecommendations(recs);
      setIsLoading(false);
    }, 1200);
  };

  // Planning mode label
  const planningLabel = planningMode && planningDate
    ? (() => {
        const parts = planningDate.split('-').map(Number);
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
      })()
    : null;

  const textTertiary = ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.28)';

  return (
    <div className="flex flex-col gap-3">
      {/* ── Concierge Button ── */}
      <motion.button
        onClick={handleAsk}
        whileTap={{ scale: 0.97 }}
        className="w-full rounded-2xl p-3.5 flex items-center gap-3 transition-all duration-300 backdrop-blur-md relative overflow-hidden group"
        style={{
          background: ghostMode
            ? 'rgba(20,20,22,0.5)'
            : isOpen
            ? `linear-gradient(135deg, ${PURPLE_DIM}0.12), ${CYAN_DIM}0.06))`
            : `linear-gradient(135deg, rgba(255,215,0,0.06), ${PURPLE_DIM}0.06))`,
          border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : isOpen ? `${PURPLE_DIM}0.22)` : 'rgba(255,215,0,0.15)'}`,
          boxShadow: ghostMode ? 'none' : isOpen ? `0 0 20px ${PURPLE_DIM}0.08)` : '0 0 20px rgba(255,215,0,0.04)',
        }}
      >
        {/* Shimmer effect */}
        {!ghostMode && !isOpen && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(105deg, transparent 40%, rgba(255,215,0,0.06) 50%, transparent 60%)',
            }}
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
          />
        )}

        {/* Concierge icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative"
          style={{
            background: ghostMode
              ? 'rgba(160,160,160,0.08)'
              : `linear-gradient(135deg, rgba(255,215,0,0.12), ${PURPLE_DIM}0.12))`,
            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(255,215,0,0.18)'}`,
            boxShadow: ghostMode ? 'none' : '0 0 16px rgba(255,215,0,0.06)',
          }}
        >
          <span className="text-lg">            {planningMode ? '\uD83D\uDCC5' : isOpen ? '\u2728' : '\uD83C\uDF74'}</span>
        </div>

        <div className="flex flex-col items-start flex-1">
          <span
            className="text-[13px] font-semibold font-mono"
            style={{
              color: ghostMode ? 'rgba(200,200,200,0.7)' : planningMode ? PURPLE : GOLD,
              textShadow: ghostMode ? 'none' : planningMode ? '0 0 12px rgba(191,90,242,0.2)' : '0 0 12px rgba(255,215,0,0.2)',
            }}
          >
            {planningMode ? 'Plan Meals' : 'Vive Concierge'}
          </span>
          <span className="text-[10px] font-mono" style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : planningMode ? 'rgba(191,90,242,0.4)' : 'rgba(255,215,0,0.4)' }}>
            {isOpen ? 'Tap to close' : planningMode ? `Plan for ${planningLabel || 'this day'}` : 'What should I eat?'}
          </span>
        </div>

        {/* Arrow */}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ghostMode ? 'rgba(160,160,160,0.4)' : GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.div>
      </motion.button>

      {/* ── Recommendation Panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, scale: 0.98 }}
            animate={{ opacity: 1, height: 'auto', scale: 1 }}
            exit={{ opacity: 0, height: 0, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            {isLoading ? (
              /* Loading state */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl p-8 flex flex-col items-center gap-4 backdrop-blur-md"
                style={{
                  background: ghostMode ? 'rgba(20,20,22,0.6)' : 'rgba(8,8,12,0.65)',
                  border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(255,215,0,0.1)'}`,
                }}
              >
                {/* Scanning animation */}
                <div className="relative w-16 h-16">
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      border: `2px solid ${ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(255,215,0,0.3)'}`,
                    }}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0.1, 0.6] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.span
                      className="text-2xl"
                      animate={{ rotateY: [0, 360] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      {'\uD83E\uDDE0'}
                    </motion.span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[12px] font-mono font-semibold" style={{ color: ghostMode ? 'rgba(200,200,200,0.6)' : GOLD }}>
                  {planningMode ? 'Planning your meals...' : 'Analyzing your profile...'}
                </span>
                <span className="text-[10px] font-mono" style={{ color: textTertiary }}>
                  {planningMode ? `Optimizing for ${planningLabel || 'selected day'}` : 'Bio-Vault + Vitals + Flavor Profile'}
                  </span>
                </div>
                {/* Scanning bars */}
                <div className="flex gap-1 items-end h-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 rounded-full"
                      style={{ background: ghostMode ? 'rgba(160,160,160,0.3)' : `linear-gradient(to top, ${PURPLE}, ${GOLD})` }}
                      animate={{ height: [4, 12 + Math.random() * 12, 4] }}
                      transition={{ duration: 0.6 + Math.random() * 0.4, repeat: Infinity, delay: i * 0.08 }}
                    />
                  ))}
                </div>
              </motion.div>
            ) : recommendations ? (
              /* Results */
              <div className="flex flex-col gap-3">
                {/* Header */}
                <div className="flex items-center gap-2 px-1">
                  <div className="h-px flex-1" style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,215,0,0.1)' }} />
                  <span className="text-[9px] font-mono uppercase tracking-[0.2em]" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,215,0,0.45)' }}>
                    {planningMode ? `Meal plan for ${planningLabel || 'selected day'}` : bioVaultData ? 'Personalized for you' : 'General recommendations'}
                  </span>
                  <div className="h-px flex-1" style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,215,0,0.1)' }} />
                </div>

                {recommendations.map((meal, idx) => (
                  <motion.div
                    key={meal.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.12 }}
                    className="rounded-2xl overflow-hidden backdrop-blur-md relative"
                    style={{
                      background: ghostMode ? 'rgba(20,20,22,0.6)' : 'rgba(8,8,12,0.65)',
                      border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : idx === 0 ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.06)'}`,
                      boxShadow: ghostMode ? 'none' : idx === 0 ? '0 0 24px rgba(255,215,0,0.04)' : '0 2px 12px rgba(0,0,0,0.3)',
                    }}
                  >
                    {/* Top glow for top pick */}
                    {idx === 0 && !ghostMode && (
                      <div className="absolute top-0 left-4 right-4 h-[1px]" style={{
                        background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.4), rgba(255,215,0,0.2), transparent)',
                      }} />
                    )}

                    <div className="p-4">
                      {/* Meal header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                          style={{
                            background: ghostMode ? 'rgba(160,160,160,0.06)' : idx === 0 ? 'rgba(255,215,0,0.08)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : idx === 0 ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.06)'}`,
                          }}
                        >
                          {meal.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[14px] font-semibold truncate" style={{ color: ghostMode ? 'rgba(220,220,220,0.7)' : 'rgba(255,255,255,0.92)' }}>
                              {meal.name}
                            </span>
                            <PriorityBadge priority={meal.priority} ghostMode={ghostMode} />
                          </div>
                          <p className="text-[11px] font-mono leading-relaxed" style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(255,255,255,0.45)' }}>
                            {meal.description}
                          </p>
                        </div>
                      </div>

                      {/* Reason — the "why" */}
                      <div
                        className="rounded-xl p-2.5 mb-3 flex items-start gap-2"
                        style={{
                          background: ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(255,215,0,0.04)',
                          border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.05)' : 'rgba(255,215,0,0.08)'}`,
                        }}
                      >
                        <span className="text-[10px] mt-0.5 flex-shrink-0">{'\uD83E\uDDE0'}</span>
                        <span className="text-[10px] font-mono leading-relaxed" style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(255,215,0,0.65)' }}>
                          {meal.reason}
                        </span>
                      </div>

                      {/* Tags + Macros */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {meal.tags.map(tag => (
                            <span
                              key={tag}
                              className="text-[8px] font-mono uppercase tracking-[0.1em] px-2 py-0.5 rounded-full"
                              style={{
                                color: ghostMode ? 'rgba(160,160,160,0.4)' : `${CYAN_DIM}0.7)`,
                                background: ghostMode ? 'rgba(160,160,160,0.04)' : `${CYAN_DIM}0.06)`,
                                border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : `${CYAN_DIM}0.12)`}`,
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : '#00FFCC' }}>
                            {meal.protein}g P
                          </span>
                          <span className="text-[8px]" style={{ color: textTertiary }}>{'\u00B7'}</span>
                          <span className="text-[10px] font-mono tabular-nums" style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.35)' }}>
                            {meal.calories} kcal
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <a
                          href={`https://www.misfitsmarket.com/search?q=${meal.searchQuery.replace(/\+/g, '%20')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 rounded-xl py-2.5 px-3 flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                          style={{
                            background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(48,209,88,0.08)',
                            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(48,209,88,0.2)'}`,
                          }}
                        >
                          <span className="text-sm">{'\uD83E\uDD66'}</span>
                          <div className="flex flex-col items-start">
                            <span className="text-[10px] font-mono font-semibold" style={{ color: ghostMode ? 'rgba(160,160,160,0.6)' : '#30D158' }}>
                              Get Ingredients
                            </span>
                            <span className="text-[8px] font-mono" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(48,209,88,0.45)' }}>
                              Misfits Market
                            </span>
                          </div>
                        </a>

                        <a
                          href={`https://www.doordash.com/search/store/${meal.searchQuery.replace(/\+/g, '%20')}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 rounded-xl py-2.5 px-3 flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                          style={{
                            background: ghostMode ? 'rgba(160,160,160,0.06)' : `${PURPLE_DIM}0.08)`,
                            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${PURPLE_DIM}0.2)`}`,
                          }}
                        >
                          <span className="text-sm">{'\uD83D\uDEF5'}</span>
                          <div className="flex flex-col items-start">
                            <span className="text-[10px] font-mono font-semibold" style={{ color: ghostMode ? 'rgba(160,160,160,0.6)' : PURPLE }}>
                              Order Now
                            </span>
                            <span className="text-[8px] font-mono" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : `${PURPLE_DIM}0.45)` }}>
                              DoorDash
                            </span>
                          </div>
                        </a>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Data source indicator */}
                <div className="flex items-center justify-center gap-2 py-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: ghostMode ? 'rgba(160,160,160,0.2)' : bioVaultData ? '#30D158' : 'rgba(255,255,255,0.15)' }} />
                  <span className="text-[9px] font-mono" style={{ color: textTertiary }}>
                    {bioVaultData
                      ? 'Powered by your Bio-Vault + System Vitals'
                      : 'Add blood panels in Briefing Room for personalized picks'}
                  </span>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
