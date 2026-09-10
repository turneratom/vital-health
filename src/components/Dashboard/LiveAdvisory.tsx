import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGhostMode } from '@/components/Presence/usePresenceState';

/* ── Types ── */
interface LiveAdvisoryProps {
  foodCalories: number;
  foodProtein: number;
  foodCarbs: number;
  foodFat: number;
  activityCalories: number;
  steps: number;
  foodLogCount: number;
  activityLogCount: number;
}

interface InsightItem {
  id: string;
  icon: string;
  label: string;
  message: string;
  accent: string;
  priority: number;
}

/* ── Sleep prediction engine ── */
function predictSleepQuality(data: LiveAdvisoryProps): number {
  let score = 78;

  const strainRatio = data.activityCalories / 500;
  if (strainRatio > 0.3 && strainRatio < 1.5) score += 6;
  else if (strainRatio >= 1.5) score -= 3;

  const proteinRatio = data.foodProtein / 160;
  if (proteinRatio > 0.5) score += 3;

  const calRatio = data.foodCalories / 2400;
  if (calRatio > 0.4 && calRatio < 0.9) score += 4;
  else if (calRatio > 1.1) score -= 2;

  const stepRatio = data.steps / 10000;
  if (stepRatio > 0.5) score += 3;

  const hour = new Date().getHours();
  if (hour > 14 && hour < 20) score -= 2;

  return Math.max(50, Math.min(98, Math.round(score)));
}

/* ── Generate contextual insights — Athletic Director partner voice ── */
function generateInsights(data: LiveAdvisoryProps): InsightItem[] {
  const insights: InsightItem[] = [];
  const hour = new Date().getHours();

  // Hydration insight
  if (hour > 10 && hour < 16) {
    insights.push({
      id: 'hydration',
      icon: '\uD83D\uDCA7',
      label: 'Hydration Window',
      message: 'Based on our activity so far, we should add about 12oz of water before the next meal. Small move, big payoff.',
      accent: '#64D2FF',
      priority: 2,
    });
  }

  // Macro balance insight
  const totalMacroG = data.foodProtein + data.foodCarbs + data.foodFat;
  if (totalMacroG > 0) {
    const proteinPct = Math.round((data.foodProtein / totalMacroG) * 100);
    if (proteinPct < 25) {
      insights.push({
        id: 'protein',
        icon: '\uD83E\uDD69',
        label: 'Protein Opportunity',
        message: `We're at ${proteinPct}% protein right now. Let's add a quality source at the next meal — our recovery will thank us.`,
        accent: '#FF375F',
        priority: 1,
      });
    } else {
      insights.push({
        id: 'protein',
        icon: '\uD83D\uDCAA',
        label: 'Protein On Point',
        message: `We're sitting at ${proteinPct}% protein — that's well-balanced for today's recovery demands. Nice work.`,
        accent: '#30D158',
        priority: 3,
      });
    }
  }

  // Activity insight
  if (data.steps < 4000 && hour > 12) {
    insights.push({
      id: 'movement',
      icon: '\uD83D\uDEB6',
      label: 'Session on Standby',
      message: 'We\'ve prioritized recovery today, and that\'s fine. A 15-minute walk this afternoon would round things out nicely.',
      accent: '#FFB86B',
      priority: 1,
    });
  } else if (data.steps > 8000) {
    insights.push({
      id: 'movement',
      icon: '\uD83C\uDFC3',
      label: 'Strong Output',
      message: 'We\'ve been moving well today. This kind of consistent effort is what builds our aerobic base over time.',
      accent: '#30D158',
      priority: 3,
    });
  }

  // Calorie balance
  const netCalories = data.foodCalories - data.activityCalories;
  if (data.foodCalories > 0 && netCalories < 1200 && hour > 14) {
    insights.push({
      id: 'fuel',
      icon: '\u26A1',
      label: 'Fuel Check',
      message: `We're at ${netCalories} net calories. Let's get a protein-rich snack in — we want to carry energy into the evening, not crash.`,
      accent: '#FBBF24',
      priority: 1,
    });
  }

  // Glucose stability
  if (data.foodCarbs > 180) {
    insights.push({
      id: 'glucose',
      icon: '\uD83E\uDE78',
      label: 'Objective Pivoted',
      message: 'Carb intake is running higher than planned. We can stabilize by pairing the next meal with fiber or healthy fat. Easy adjustment.',
      accent: '#FF9500',
      priority: 1,
    });
  }

  return insights.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

/* ── Main Component ── */
export function LiveAdvisory(props: LiveAdvisoryProps) {
  const ghostMode = useGhostMode();
  const [isExpanded, setIsExpanded] = useState(false);
  const [pulsePhase, setPulsePhase] = useState(0);
  const [activeInsightIdx, setActiveInsightIdx] = useState(0);

  const sleepPrediction = useMemo(() => predictSleepQuality(props), [props]);
  const insights = useMemo(() => generateInsights(props), [props]);

  useEffect(() => {
    const t = setInterval(() => setPulsePhase((p) => (p + 1) % 3), 2500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isExpanded && insights.length > 1) {
      const t = setInterval(() => {
        setActiveInsightIdx((p) => (p + 1) % insights.length);
      }, 5000);
      return () => clearInterval(t);
    }
  }, [isExpanded, insights.length]);

  const neon = ghostMode ? 'rgba(160,160,160,' : 'rgba(0,255,204,';
  const purpleCyan = ghostMode
    ? 'rgba(160,160,160,0.15)'
    : 'linear-gradient(135deg, rgba(175,130,255,0.25), rgba(0,255,204,0.25))';

  const sleepColor =
    sleepPrediction >= 85
      ? ghostMode ? 'rgba(160,160,160,0.7)' : '#30D158'
      : sleepPrediction >= 70
        ? ghostMode ? 'rgba(160,160,160,0.6)' : '#FBBF24'
        : ghostMode ? 'rgba(160,160,160,0.5)' : '#FF9500';

  const sleepGlow =
    sleepPrediction >= 85
      ? '0 0 12px rgba(48,209,88,0.3)'
      : sleepPrediction >= 70
        ? '0 0 12px rgba(251,191,36,0.3)'
        : '0 0 12px rgba(255,149,0,0.3)';

  const currentInsight = insights[activeInsightIdx] || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="w-full"
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-left"
      >
        <div
          className="relative overflow-hidden rounded-2xl border p-[1px]"
          style={{
            background: ghostMode
              ? 'rgba(160,160,160,0.08)'
              : purpleCyan,
          }}
        >
          {/* Inner card */}
          <div
            className="relative rounded-[15px] px-5 py-4 overflow-hidden"
            style={{
              background: ghostMode ? 'rgba(10,10,10,0.95)' : 'rgba(8,8,12,0.95)',
              backdropFilter: 'blur(24px)',
            }}
          >
            {/* Subtle animated gradient background */}
            {!ghostMode && (
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  background: 'linear-gradient(135deg, #AF82FF 0%, transparent 40%, #00FFCC 80%, transparent 100%)',
                  backgroundSize: '200% 200%',
                  animation: 'advisoryShimmer 8s ease-in-out infinite',
                }}
              />
            )}

            <div className="relative z-10">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  {/* Brain icon with pulse */}
                  <div className="relative w-7 h-7 flex items-center justify-center">
                    <motion.div
                      animate={{
                        scale: pulsePhase === 0 ? [1, 1.3, 1] : 1,
                        opacity: pulsePhase === 0 ? [0.3, 0.6, 0.3] : 0.3,
                      }}
                      transition={{ duration: 2, ease: 'easeInOut' }}
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: ghostMode
                          ? 'rgba(160,160,160,0.15)'
                          : 'radial-gradient(circle, rgba(175,130,255,0.3), rgba(0,255,204,0.15))',
                      }}
                    />
                    <span className="relative text-sm" style={{ filter: ghostMode ? 'grayscale(1) opacity(0.5)' : 'none' }}>
                      🧠
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span
                      className="typo-header text-[11px] tracking-[0.15em]"
                      style={{
                        background: ghostMode
                          ? 'none'
                          : 'linear-gradient(90deg, #AF82FF, #00FFCC)',
                        WebkitBackgroundClip: ghostMode ? 'unset' : 'text',
                        WebkitTextFillColor: ghostMode ? 'rgba(160,160,160,0.5)' : 'transparent',
                        color: ghostMode ? 'rgba(160,160,160,0.5)' : undefined,
                      }}
                    >
                      Vive Advisory
                    </span>
                    <span
                      className="typo-label tracking-wider"
                      style={{ color: `${neon}0.35)` }}
                    >
                      Your Performance Partner
                    </span>
                  </div>
                </div>

                {/* Sleep prediction badge */}
                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{
                      background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(94,92,230,0.08)',
                      border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(94,92,230,0.15)'}`,
                    }}
                  >
                    <span className="text-[10px]" style={{ filter: ghostMode ? 'grayscale(1) opacity(0.5)' : 'none' }}>🌙</span>
                    <span
                      className="typo-data text-[11px]"
                      style={{
                        color: sleepColor,
                        textShadow: ghostMode ? 'none' : sleepGlow,
                      }}
                    >
                      {sleepPrediction}%
                    </span>
                  </div>

                  {/* Expand chevron */}
                  <motion.svg
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.25 }}
                    width="10" height="6" viewBox="0 0 10 6" fill="none"
                  >
                    <path d="M1 1L5 5L9 1" stroke={ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.25)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </motion.svg>
                </div>
              </div>

              {/* Primary prediction line — partner voice */}
              <div className="flex items-start gap-2 mb-1">
                <p
                  className="text-[13px] font-medium leading-relaxed"
                  style={{ color: ghostMode ? 'rgba(200,200,200,0.65)' : 'rgba(255,255,255,0.8)' }}
                >
                  We're tracking toward a{' '}
                  <span
                    className="font-bold"
                    style={{
                      color: sleepColor,
                      textShadow: ghostMode ? 'none' : sleepGlow,
                    }}
                  >
                    {sleepPrediction}%
                  </span>
                  {' '}sleep quality tonight based on today{"'"}s strain and nutrition balance.
                </p>
              </div>

              {/* Cycling insight preview (collapsed) */}
              {!isExpanded && currentInsight && (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentInsight.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-2 mt-2 pt-2"
                    style={{ borderTop: `0.5px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)'}` }}
                  >
                    <span className="text-xs" style={{ filter: ghostMode ? 'grayscale(1) opacity(0.5)' : 'none' }}>
                      {currentInsight.icon}
                    </span>
                    <span
                      className="text-[11px] font-medium leading-snug flex-1"
                      style={{ color: ghostMode ? 'rgba(160,160,160,0.45)' : `${currentInsight.accent}CC` }}
                    >
                      {currentInsight.message}
                    </span>
                    {insights.length > 1 && (
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        {insights.map((_, i) => (
                          <div
                            key={i}
                            className="w-1 h-1 rounded-full transition-all duration-300"
                            style={{
                              background: i === activeInsightIdx
                                ? (ghostMode ? 'rgba(160,160,160,0.5)' : '#AF82FF')
                                : (ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(255,255,255,0.12)'),
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}

              {/* Expanded insights */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden"
                  >
                    <div
                      className="mt-3 pt-3 flex flex-col gap-3"
                      style={{ borderTop: `0.5px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)'}` }}
                    >
                      {/* Data sources row */}
                      <div className="flex items-center gap-3 mb-1">
                        <DataSourcePill
                          icon="❤️"
                          label="Vitals"
                          value="72 BPM"
                          ghostMode={ghostMode}
                        />
                        <DataSourcePill
                          icon="🍽"
                          label="Fuel"
                          value={`${props.foodCalories} cal`}
                          ghostMode={ghostMode}
                        />
                        <DataSourcePill
                          icon="🏃"
                          label="Output"
                          value={`${props.steps.toLocaleString()} steps`}
                          ghostMode={ghostMode}
                        />
                      </div>

                      {/* All insights */}
                      {insights.map((insight, idx) => (
                        <motion.div
                          key={insight.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25, delay: idx * 0.06 }}
                          className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                          style={{
                            background: ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(255,255,255,0.02)',
                            border: `0.5px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)'}`,
                          }}
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{
                              background: ghostMode ? 'rgba(160,160,160,0.06)' : `${insight.accent}15`,
                            }}
                          >
                            <span className="text-xs" style={{ filter: ghostMode ? 'grayscale(1) opacity(0.5)' : 'none' }}>
                              {insight.icon}
                            </span>
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <span
                              className="text-[11px] uppercase tracking-wider font-semibold mb-0.5"
                              style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : insight.accent, fontFamily: "'Inter', sans-serif" }}
                            >
                              {insight.label}
                            </span>
                            <span
                              className="text-[12px] leading-relaxed"
                              style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.55)' }}
                            >
                              {insight.message}
                            </span>
                          </div>
                        </motion.div>
                      ))}

                      {/* Prediction breakdown */}
                      <div
                        className="flex items-center gap-4 px-3 py-3 rounded-xl mt-1"
                        style={{
                          background: ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(94,92,230,0.04)',
                          border: `0.5px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(94,92,230,0.1)'}`,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm" style={{ filter: ghostMode ? 'grayscale(1) opacity(0.5)' : 'none' }}>🌙</span>
                          <div className="flex flex-col">
                            <span
                              className="text-[10px] uppercase tracking-wider"
                              style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(94,92,230,0.6)', fontFamily: "'Inter', sans-serif" }}
                            >
                              Tonight&apos;s Outlook
                            </span>
                            <span
                              className="text-[18px] font-bold tabular-nums"
                              style={{
                                color: sleepColor,
                                textShadow: ghostMode ? 'none' : sleepGlow,
                              }}
                            >
                              {sleepPrediction}%
                            </span>
                          </div>
                        </div>

                        {/* Mini factors */}
                        <div className="flex-1 flex flex-col gap-1.5 ml-2">
                          <PredictionFactor
                            label="Strain"
                            value={props.activityCalories > 300 ? 'Well-Managed' : 'Building Up'}
                            positive={props.activityCalories > 200 && props.activityCalories < 800}
                            ghostMode={ghostMode}
                          />
                          <PredictionFactor
                            label="Nutrition"
                            value={props.foodCalories > 1500 ? 'Dialed In' : 'In Progress'}
                            positive={props.foodCalories > 1200}
                            ghostMode={ghostMode}
                          />
                          <PredictionFactor
                            label="Caffeine"
                            value={new Date().getHours() > 14 ? 'Late Window' : 'All Clear'}
                            positive={new Date().getHours() <= 14}
                            ghostMode={ghostMode}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </button>

      <style>{`
        @keyframes advisoryShimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </motion.div>
  );
}

/* ── Data Source Pill ── */
function DataSourcePill({ icon, label, value, ghostMode }: { icon: string; label: string; value: string; ghostMode: boolean }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1 rounded-full flex-1"
      style={{
        background: ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.03)',
        border: `0.5px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.05)'}`,
      }}
    >
      <span className="text-[10px]" style={{ filter: ghostMode ? 'grayscale(1) opacity(0.5)' : 'none' }}>{icon}</span>
      <div className="flex flex-col">
        <span className="text-[8px] uppercase tracking-wider" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.25)', fontFamily: "'Inter', sans-serif" }}>
          {label}
        </span>
        <span className="text-[10px] font-semibold tabular-nums" style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(255,255,255,0.55)', fontFamily: "'Inter', sans-serif" }}>
          {value}
        </span>
      </div>
    </div>
  );
}

/* ── Prediction Factor Row ── */
function PredictionFactor({ label, value, positive, ghostMode }: { label: string; value: string; positive: boolean; ghostMode: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px]" style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.35)', fontFamily: "'Inter', sans-serif" }}>
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: positive
              ? (ghostMode ? 'rgba(160,160,160,0.5)' : '#30D158')
              : (ghostMode ? 'rgba(160,160,160,0.3)' : '#FBBF24'),
            boxShadow: positive && !ghostMode ? '0 0 4px rgba(48,209,88,0.4)' : 'none',
          }}
        />
        <span
          className="text-[10px] font-medium"
          style={{
            color: positive
              ? (ghostMode ? 'rgba(160,160,160,0.5)' : '#30D158')
              : (ghostMode ? 'rgba(160,160,160,0.4)' : '#FBBF24'),
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
