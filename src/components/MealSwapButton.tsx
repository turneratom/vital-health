import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGhostMode } from '@/components/Presence/usePresenceState';

/* ── Types ── */
export interface PlannedMeal {
  id: string;
  slot: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fuelScore: number;
  tags?: string[];
}

interface MealSwapButtonProps {
  meal: PlannedMeal;
  onSwap: (oldMeal: PlannedMeal, newMeal: PlannedMeal) => void;
  compact?: boolean;
}

/* ── AI Swap Engine (mock) ── */
const SWAP_ALTERNATIVES: Record<string, Array<Omit<PlannedMeal, 'id' | 'slot' | 'time'>>> = {
  breakfast: [
    { name: 'Greek Yogurt Parfait', calories: 320, protein: 28, carbs: 38, fat: 10, fuelScore: 8, tags: ['high-protein', 'probiotic'] },
    { name: 'Egg White Omelette', calories: 280, protein: 32, carbs: 8, fat: 12, fuelScore: 9, tags: ['low-carb', 'high-protein'] },
    { name: 'Overnight Oats', calories: 380, protein: 18, carbs: 52, fat: 12, fuelScore: 7, tags: ['fiber', 'slow-release'] },
    { name: 'Smoked Salmon Toast', calories: 340, protein: 26, carbs: 28, fat: 14, fuelScore: 9, tags: ['omega-3', 'vitamin-d'] },
    { name: 'Protein Smoothie Bowl', calories: 310, protein: 30, carbs: 35, fat: 8, fuelScore: 8, tags: ['antioxidant', 'recovery'] },
  ],
  lunch: [
    { name: 'Turkey & Avocado Wrap', calories: 440, protein: 38, carbs: 32, fat: 20, fuelScore: 8, tags: ['balanced', 'healthy-fats'] },
    { name: 'Quinoa Power Bowl', calories: 420, protein: 28, carbs: 48, fat: 16, fuelScore: 8, tags: ['complete-protein', 'fiber'] },
    { name: 'Grilled Chicken Caesar', calories: 380, protein: 42, carbs: 14, fat: 18, fuelScore: 9, tags: ['high-protein', 'low-carb'] },
    { name: 'Salmon Poke Bowl', calories: 460, protein: 36, carbs: 42, fat: 18, fuelScore: 9, tags: ['omega-3', 'anti-inflammatory'] },
    { name: 'Mediterranean Plate', calories: 400, protein: 24, carbs: 38, fat: 22, fuelScore: 8, tags: ['heart-healthy', 'fiber'] },
  ],
  dinner: [
    { name: 'Herb-Crusted Salmon', calories: 420, protein: 44, carbs: 8, fat: 22, fuelScore: 9, tags: ['omega-3', 'vitamin-d'] },
    { name: 'Lean Steak & Greens', calories: 480, protein: 48, carbs: 12, fat: 26, fuelScore: 8, tags: ['iron', 'b12'] },
    { name: 'Chicken Stir-Fry', calories: 400, protein: 38, carbs: 32, fat: 14, fuelScore: 8, tags: ['balanced', 'vegetables'] },
    { name: 'Baked Cod & Vegetables', calories: 340, protein: 38, carbs: 18, fat: 12, fuelScore: 9, tags: ['lean', 'anti-inflammatory'] },
    { name: 'Turkey Meatballs & Zucchini', calories: 380, protein: 36, carbs: 22, fat: 16, fuelScore: 8, tags: ['lean-protein', 'low-carb'] },
  ],
  snack: [
    { name: 'Protein Bar', calories: 220, protein: 20, carbs: 24, fat: 8, fuelScore: 7, tags: ['convenient', 'protein'] },
    { name: 'Apple & Almond Butter', calories: 240, protein: 8, carbs: 28, fat: 14, fuelScore: 7, tags: ['fiber', 'healthy-fats'] },
    { name: 'Cottage Cheese & Berries', calories: 180, protein: 22, carbs: 16, fat: 4, fuelScore: 8, tags: ['casein', 'antioxidant'] },
    { name: 'Trail Mix (30g)', calories: 170, protein: 6, carbs: 14, fat: 12, fuelScore: 6, tags: ['energy', 'minerals'] },
    { name: 'Hard Boiled Eggs (2)', calories: 140, protein: 12, carbs: 1, fat: 10, fuelScore: 8, tags: ['complete-protein', 'choline'] },
  ],
};

async function mockAISwap(meal: PlannedMeal): Promise<PlannedMeal> {
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
  const pool = SWAP_ALTERNATIVES[meal.slot] || SWAP_ALTERNATIVES.lunch;
  const filtered = pool.filter((alt) => alt.name !== meal.name);
  // Pick one with similar macro profile (within 20% calorie range)
  const similar = filtered.filter(
    (alt) => Math.abs(alt.calories - meal.calories) < meal.calories * 0.25
  );
  const pick = (similar.length > 0 ? similar : filtered)[Math.floor(Math.random() * (similar.length > 0 ? similar : filtered).length)];
  return {
    id: crypto.randomUUID(),
    slot: meal.slot,
    time: meal.time,
    ...pick,
  };
}

/* ── Swap Button Component ── */
export function MealSwapButton({ meal, onSwap, compact }: MealSwapButtonProps) {
  const ghostMode = useGhostMode();
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapResult, setSwapResult] = useState<PlannedMeal | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSwap = useCallback(async () => {
    if (isSwapping) return;
    setIsSwapping(true);
    setSwapResult(null);
    try {
      const newMeal = await mockAISwap(meal);
      setSwapResult(newMeal);
      setShowConfirm(true);
    } catch {
      /* silent */
    } finally {
      setIsSwapping(false);
    }
  }, [meal, isSwapping]);

  const confirmSwap = useCallback(() => {
    if (swapResult) {
      onSwap(meal, swapResult);
      setShowConfirm(false);
      setSwapResult(null);
    }
  }, [meal, swapResult, onSwap]);

  const cancelSwap = useCallback(() => {
    setShowConfirm(false);
    setSwapResult(null);
  }, []);

  const purple = ghostMode ? 'rgba(160,160,160,' : 'rgba(175,130,255,';
  const cyan = ghostMode ? 'rgba(160,160,160,' : 'rgba(0,255,204,';

  return (
    <div className="relative">
      {/* Swap trigger button */}
      <motion.button
        onClick={handleSwap}
        disabled={isSwapping || showConfirm}
        whileTap={{ scale: 0.92 }}
        className="flex items-center gap-1.5 rounded-full border transition-all duration-200"
        style={{
          padding: compact ? '3px 8px' : '4px 10px',
          background: isSwapping
            ? `${purple}0.15)`
            : `${purple}0.06)`,
          borderColor: isSwapping
            ? `${purple}0.3)`
            : `${purple}0.12)`,
          opacity: isSwapping ? 0.7 : 1,
        }}
      >
        {isSwapping ? (
          <motion.div
            className="rounded-full border-2 border-t-transparent"
            style={{
              width: compact ? 10 : 12,
              height: compact ? 10 : 12,
              borderColor: `${purple}0.5) transparent ${purple}0.5) ${purple}0.5)`,
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
          />
        ) : (
          <svg
            width={compact ? 10 : 12}
            height={compact ? 10 : 12}
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M1 10.5L4 13.5L4 8M15 5.5L12 2.5L12 8"
              stroke={ghostMode ? 'rgba(160,160,160,0.5)' : '#AF82FF'}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 8H12M12 8H4"
              stroke={ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(175,130,255,0.4)'}
              strokeWidth="1"
              strokeLinecap="round"
              strokeDasharray="2 2"
            />
          </svg>
        )}
        <span
          className="font-semibold uppercase tracking-wider"
          style={{
            fontSize: compact ? 8 : 9,
            color: ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(175,130,255,0.7)',
          }}
        >
          {isSwapping ? 'Finding...' : 'Swap'}
        </span>
      </motion.button>

      {/* Swap confirmation overlay */}
      <AnimatePresence>
        {showConfirm && swapResult && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute right-0 top-full mt-2 z-50 rounded-xl border p-3 min-w-[220px]"
            style={{
              background: ghostMode
                ? 'rgba(20,20,20,0.98)'
                : 'rgba(10,8,18,0.98)',
              borderColor: `${purple}0.2)`,
              backdropFilter: 'blur(24px)',
              boxShadow: ghostMode
                ? '0 8px 32px rgba(0,0,0,0.6)'
                : '0 8px 32px rgba(0,0,0,0.6), 0 0 40px rgba(175,130,255,0.08)',
            }}
          >
            {/* AI suggestion header */}
            <div className="flex items-center gap-1.5 mb-2">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center"
                style={{
                  background: `${purple}0.15)`,
                  border: `1px solid ${purple}0.25)`,
                }}
              >
                <span style={{ fontSize: 8, color: ghostMode ? '#a0a0a0' : '#AF82FF' }}>V</span>
              </div>
              <span
                className="font-semibold uppercase tracking-[0.15em]"
                style={{ fontSize: 9, color: `${purple}0.6)` }}
              >
                AI Suggestion
              </span>
            </div>

            {/* New meal preview */}
            <div className="mb-2.5">
              <p
                className="text-xs font-semibold leading-tight"
                style={{ color: ghostMode ? 'rgba(220,220,220,0.8)' : 'rgba(255,255,255,0.85)' }}
              >
                {swapResult.name}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[9px] tabular-nums font-medium" style={{ color: `${cyan}0.7)` }}>
                  {swapResult.calories} cal
                </span>
                <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
                <span className="text-[9px] tabular-nums" style={{ color: 'rgba(0,255,204,0.5)' }}>
                  P:{swapResult.protein}g
                </span>
                <span className="text-[9px] tabular-nums" style={{ color: 'rgba(107,138,255,0.5)' }}>
                  C:{swapResult.carbs}g
                </span>
                <span className="text-[9px] tabular-nums" style={{ color: 'rgba(255,184,107,0.5)' }}>
                  F:{swapResult.fat}g
                </span>
              </div>
              {/* Tags */}
              {swapResult.tags && swapResult.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {swapResult.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[7px] uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                      style={{
                        color: `${cyan}0.5)`,
                        background: `${cyan}0.06)`,
                        border: `1px solid ${cyan}0.08)`,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {/* Fuel score comparison */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[8px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Fuel Score
                </span>
                <span
                  className="text-[10px] font-bold tabular-nums"
                  style={{
                    color: swapResult.fuelScore >= 8
                      ? '#30D158'
                      : swapResult.fuelScore >= 6
                        ? '#00FFCC'
                        : '#FBBF24',
                  }}
                >
                  {swapResult.fuelScore}/10
                </span>
                {swapResult.fuelScore > meal.fuelScore && (
                  <span className="text-[8px] font-medium" style={{ color: '#30D158' }}>
                    +{swapResult.fuelScore - meal.fuelScore} upgrade
                  </span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={confirmSwap}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200"
                style={{
                  background: ghostMode ? 'rgba(160,160,160,0.12)' : 'rgba(175,130,255,0.15)',
                  color: ghostMode ? 'rgba(200,200,200,0.8)' : '#AF82FF',
                  border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.2)' : 'rgba(175,130,255,0.25)'}`,
                }}
              >
                Accept
              </button>
              <button
                onClick={cancelSwap}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  color: 'rgba(255,255,255,0.35)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                Keep
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Weekly Meal Plan Generator ── */
export function generateWeeklyMealPlan(): Record<string, PlannedMeal[]> {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const now = new Date();
  const currentDayIndex = (now.getDay() + 6) % 7; // Mon=0

  const mealTemplates: Record<string, Array<{ name: string; calories: number; protein: number; carbs: number; fat: number; fuelScore: number }>> = {
    breakfast: [
      { name: 'Oatmeal & Berries', calories: 350, protein: 18, carbs: 52, fat: 10, fuelScore: 7 },
      { name: 'Egg White Omelette', calories: 280, protein: 32, carbs: 8, fat: 12, fuelScore: 9 },
      { name: 'Greek Yogurt Bowl', calories: 320, protein: 28, carbs: 38, fat: 10, fuelScore: 8 },
      { name: 'Avocado Toast & Eggs', calories: 380, protein: 22, carbs: 28, fat: 22, fuelScore: 8 },
      { name: 'Protein Smoothie', calories: 310, protein: 30, carbs: 35, fat: 8, fuelScore: 8 },
      { name: 'Smoked Salmon Toast', calories: 340, protein: 26, carbs: 28, fat: 14, fuelScore: 9 },
      { name: 'Overnight Oats', calories: 360, protein: 20, carbs: 48, fat: 12, fuelScore: 7 },
    ],
    lunch: [
      { name: 'Grilled Chicken Salad', calories: 420, protein: 48, carbs: 12, fat: 18, fuelScore: 9 },
      { name: 'Salmon Poke Bowl', calories: 460, protein: 36, carbs: 42, fat: 18, fuelScore: 9 },
      { name: 'Turkey Wrap', calories: 440, protein: 38, carbs: 32, fat: 20, fuelScore: 8 },
      { name: 'Quinoa Power Bowl', calories: 420, protein: 28, carbs: 48, fat: 16, fuelScore: 8 },
      { name: 'Mediterranean Plate', calories: 400, protein: 24, carbs: 38, fat: 22, fuelScore: 8 },
      { name: 'Chicken Caesar Salad', calories: 380, protein: 42, carbs: 14, fat: 18, fuelScore: 9 },
      { name: 'Tuna Nicoise', calories: 410, protein: 40, carbs: 18, fat: 20, fuelScore: 9 },
    ],
    dinner: [
      { name: 'Herb-Crusted Salmon', calories: 420, protein: 44, carbs: 8, fat: 22, fuelScore: 9 },
      { name: 'Chicken Stir-Fry', calories: 400, protein: 38, carbs: 32, fat: 14, fuelScore: 8 },
      { name: 'Lean Steak & Greens', calories: 480, protein: 48, carbs: 12, fat: 26, fuelScore: 8 },
      { name: 'Baked Cod & Veggies', calories: 340, protein: 38, carbs: 18, fat: 12, fuelScore: 9 },
      { name: 'Turkey Meatballs', calories: 380, protein: 36, carbs: 22, fat: 16, fuelScore: 8 },
      { name: 'Grilled Shrimp Bowl', calories: 360, protein: 34, carbs: 28, fat: 14, fuelScore: 8 },
      { name: 'Chicken & Sweet Potato', calories: 440, protein: 42, carbs: 36, fat: 14, fuelScore: 8 },
    ],
    snack: [
      { name: 'Protein Bar', calories: 220, protein: 20, carbs: 24, fat: 8, fuelScore: 7 },
      { name: 'Apple & Almonds', calories: 200, protein: 6, carbs: 24, fat: 12, fuelScore: 7 },
      { name: 'Cottage Cheese', calories: 180, protein: 22, carbs: 8, fat: 4, fuelScore: 8 },
      { name: 'Trail Mix', calories: 170, protein: 6, carbs: 14, fat: 12, fuelScore: 6 },
      { name: 'Hard Boiled Eggs', calories: 140, protein: 12, carbs: 1, fat: 10, fuelScore: 8 },
      { name: 'Greek Yogurt', calories: 160, protein: 18, carbs: 12, fat: 4, fuelScore: 8 },
      { name: 'Protein Shake', calories: 200, protein: 25, carbs: 10, fat: 4, fuelScore: 7 },
    ],
  };

  const plan: Record<string, PlannedMeal[]> = {};

  days.forEach((day, i) => {
    const slots: Array<{ slot: PlannedMeal['slot']; time: string }> = [
      { slot: 'breakfast', time: '07:30' },
      { slot: 'lunch', time: '12:30' },
      { slot: 'snack', time: '15:30' },
      { slot: 'dinner', time: '19:00' },
    ];

    plan[day] = slots.map(({ slot, time }) => {
      const templates = mealTemplates[slot];
      const template = templates[i % templates.length];
      return {
        id: `${day}-${slot}-${crypto.randomUUID().slice(0, 8)}`,
        slot,
        time,
        ...template,
      };
    });
  });

  return plan;
}

/* ── Get today's day key ── */
export function getTodayKey(): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date().getDay()];
}

/* ── Compute daily macro totals from planned meals ── */
export function computeDayTotals(meals: PlannedMeal[]): { calories: number; protein: number; carbs: number; fat: number; avgFuelScore: number } {
  if (meals.length === 0) return { calories: 0, protein: 0, carbs: 0, fat: 0, avgFuelScore: 0 };
  return {
    calories: meals.reduce((s, m) => s + m.calories, 0),
    protein: meals.reduce((s, m) => s + m.protein, 0),
    carbs: meals.reduce((s, m) => s + m.carbs, 0),
    fat: meals.reduce((s, m) => s + m.fat, 0),
    avgFuelScore: Math.round(meals.reduce((s, m) => s + m.fuelScore, 0) / meals.length * 10) / 10,
  };
}
