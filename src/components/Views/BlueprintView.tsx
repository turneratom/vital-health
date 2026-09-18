import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGhostMode } from '@/components/Presence/usePresenceState';

/* ── Impact levels ── */
type Impact = 'Low' | 'Medium' | 'High';

interface TraitCard {
  id: string;
  title: string;
  category: 'dietary' | 'physical' | 'risks';
  icon: string;
  impact: Impact;
  summary: string;
  details: string;
  actions: string[];
  confidence: number;
}

const impactConfig: Record<Impact, { color: string; bg: string; border: string; ghostColor: string }> = {
  Low: { color: '#34D399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', ghostColor: 'rgba(160,160,160,0.5)' },
  Medium: { color: '#FBBF24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', ghostColor: 'rgba(160,160,160,0.5)' },
  High: { color: '#F87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.2)', ghostColor: 'rgba(160,160,160,0.5)' },
};

const categoryLabels: Record<string, { label: string; icon: string; color: string }> = {
  dietary: { label: 'Dietary Needs', icon: '🥗', color: '#FFB86B' },
  physical: { label: 'Physical Strengths', icon: '⚡', color: '#00FFCC' },
  risks: { label: 'Health Risks', icon: '🛡️', color: '#FF6BB5' },
};

/* ── Trait data ── */
const traits: TraitCard[] = [
  {
    id: 'caffeine',
    title: 'Caffeine Sensitivity',
    category: 'dietary',
    icon: '☕',
    impact: 'High',
    summary: 'You process caffeine slowly; aim to stop intake by 2 PM.',
    details: 'Your liver enzyme CYP1A2 works at a slower pace, meaning caffeine stays active in your bloodstream much longer than average. That 3 PM latte could still be affecting your sleep quality at midnight.',
    actions: [
      'Cap caffeine at 200mg before noon — roughly one strong coffee',
      'Switch to green tea after lunch for gentle, sustained focus',
      'Allow 8+ hours between last caffeine and sleep',
    ],
    confidence: 94,
  },
  {
    id: 'vitamin-d',
    title: 'Vitamin D Absorption',
    category: 'dietary',
    icon: '☀️',
    impact: 'Medium',
    summary: 'Your body needs extra help converting sunlight into usable vitamin D.',
    details: 'Your VDR gene variant reduces the efficiency of vitamin D receptor binding. Even with adequate sun exposure, your blood levels may run lower than expected without supplementation.',
    actions: [
      'Supplement with 2,000-4,000 IU vitamin D3 daily with a fat-containing meal',
      'Get levels tested every 6 months — aim for 40-60 ng/mL',
      'Include vitamin D-rich foods: fatty fish, egg yolks, fortified foods',
    ],
    confidence: 87,
  },
  {
    id: 'salt',
    title: 'Salt Processing',
    category: 'dietary',
    icon: '🧂',
    impact: 'High',
    summary: 'Excess sodium hits your blood pressure harder than most people.',
    details: 'Your ACE gene variant makes your kidneys less efficient at excreting sodium. This means dietary salt has a stronger-than-average effect on your blood pressure and fluid retention.',
    actions: [
      'Target under 2,000mg sodium per day',
      'Read labels — processed foods are the #1 hidden sodium source',
      'Increase potassium-rich foods: bananas, sweet potatoes, spinach',
    ],
    confidence: 82,
  },
  {
    id: 'lactose',
    title: 'Lactose Tolerance',
    category: 'dietary',
    icon: '🥛',
    impact: 'Low',
    summary: 'You can digest dairy without issues — your lactase gene stays active.',
    details: 'You carry the persistence variant of the MCM6 gene, which keeps your lactase enzyme active into adulthood. Dairy is a viable protein and calcium source for you.',
    actions: [
      'Dairy can be a regular part of your diet if desired',
      'Greek yogurt and kefir offer probiotics alongside protein',
      'If you notice bloating, it may be casein sensitivity — not lactose',
    ],
    confidence: 96,
  },
  {
    id: 'power',
    title: 'Power & Sprint Ability',
    category: 'physical',
    icon: '🏃',
    impact: 'Low',
    summary: 'Your muscles are built for explosive power — you have elite fast-twitch fiber genetics.',
    details: 'You carry the ACTN3 R/R genotype found in 95% of Olympic sprinters. Your fast-twitch muscle fibers are fully expressed, giving you a natural advantage in explosive movements.',
    actions: [
      'Prioritize explosive training: plyometrics, Olympic lifts, sprint intervals',
      'Supplement with creatine monohydrate (5g/day)',
      'Allow 48-72 hours recovery between maximal power sessions',
    ],
    confidence: 96,
  },
  {
    id: 'endurance',
    title: 'Endurance Capacity',
    category: 'physical',
    icon: '🚴',
    impact: 'Medium',
    summary: 'Your aerobic engine is solid — consistent training will unlock strong endurance.',
    details: 'Your PPARGC1A gene shows moderate mitochondrial biogenesis potential. You can build great endurance with training, but your genetic ceiling favors moderate-duration efforts over ultra-endurance.',
    actions: [
      'Build an aerobic base with Zone 2 training (3-4 sessions/week)',
      'Include one tempo run or threshold session weekly',
      'Supplement with CoQ10 (200mg/day) for cellular energy production',
    ],
    confidence: 79,
  },
  {
    id: 'recovery',
    title: 'Recovery Speed',
    category: 'physical',
    icon: '💤',
    impact: 'Low',
    summary: 'Your muscles bounce back fast — you can handle higher training frequency.',
    details: 'Your IL-6 and TNF-alpha gene variants indicate an efficient inflammatory response. You clear metabolic waste quickly and your muscle repair processes resolve faster than average.',
    actions: [
      'You can train the same muscle group every 48 hours with proper nutrition',
      'Prioritize 7-9 hours of sleep for optimal growth hormone release',
      'Use tart cherry juice (8oz post-workout) to further reduce inflammation',
    ],
    confidence: 91,
  },
  {
    id: 'oxidative',
    title: 'Oxidative Stress Defense',
    category: 'risks',
    icon: '🛡️',
    impact: 'High',
    summary: 'Your antioxidant enzymes run at reduced capacity — extra protection needed.',
    details: 'Your SOD2 gene variant means your mitochondrial antioxidant enzyme works at about 60-70% efficiency. Under high training loads or chronic stress, free radicals accumulate faster than your body neutralizes them.',
    actions: [
      'Supplement with ubiquinol (200mg/day) for mitochondrial protection',
      'Increase vitamin C (500mg) and vitamin E daily',
      'Cap high-intensity sessions at 3-4 per week to manage oxidative load',
    ],
    confidence: 85,
  },
  {
    id: 'brain',
    title: 'Brain Health Outlook',
    category: 'risks',
    icon: '🧠',
    impact: 'Low',
    summary: 'No elevated genetic risk detected — your cognitive aging trajectory looks favorable.',
    details: 'You carry the most common and lowest-risk APOE variant. No elevated genetic risk for accelerated cognitive decline was detected in your profile.',
    actions: [
      'Maintain DHA intake (1-2g/day) from wild-caught fish or algae oil',
      'Practice cognitive challenges: puzzles, learning new skills',
      'Prioritize consistent sleep for glymphatic brain clearance',
    ],
    confidence: 92,
  },
  {
    id: 'heart',
    title: 'Heart Health Profile',
    category: 'risks',
    icon: '❤️',
    impact: 'Medium',
    summary: 'Slight tendency toward elevated LDL — manageable with diet and monitoring.',
    details: 'Your PCSK9 and APOB gene variants show a mild predisposition to elevated LDL cholesterol. This is very manageable with lifestyle interventions but worth tracking annually.',
    actions: [
      'Get a comprehensive lipid panel annually (include ApoB and Lp(a))',
      'Increase soluble fiber: oats, beans, flaxseed',
      'Maintain 150+ minutes moderate cardio per week',
    ],
    confidence: 77,
  },
];

/* ── Sparkline component ── */
function MiniSparkline({ color, ghostMode }: { color: string; ghostMode: boolean }) {
  const points = [4, 6, 3, 7, 5, 8, 6, 9, 7, 8];
  const max = Math.max(...points);
  const min = Math.min(...points);
  const h = 20;
  const w = 48;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / (max - min)) * h;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <path
        d={path}
        fill="none"
        stroke={ghostMode ? 'rgba(160,160,160,0.2)' : color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Impact Badge ── */
function ImpactBadge({ impact, ghostMode }: { impact: Impact; ghostMode: boolean }) {
  const config = impactConfig[impact];
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full"
      style={{
        color: ghostMode ? config.ghostColor : config.color,
        background: ghostMode ? 'rgba(160,160,160,0.06)' : config.bg,
        border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : config.border}`,
      }}
    >
      {impact} Impact
    </span>
  );
}

/* ── Confidence Dots ── */
function ConfidenceDots({ value, color, ghostMode }: { value: number; color: string; ghostMode: boolean }) {
  const filled = Math.round(value / 20);
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="text-[9px] font-mono mr-1"
        style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.3)' }}
      >
        Confidence
      </span>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="w-1.5 h-1.5 rounded-full transition-all duration-500"
          style={{
            background: i < filled
              ? (ghostMode ? 'rgba(160,160,160,0.4)' : color)
              : (ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(255,255,255,0.06)'),
            boxShadow: i < filled && !ghostMode ? `0 0 4px ${color}40` : 'none',
          }}
        />
      ))}
      <span
        className="text-[9px] font-mono font-semibold tabular-nums ml-1"
        style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : color }}
      >
        {value}%
      </span>
    </div>
  );
}

/* ── Trait Card Component ── */
function TraitCardComponent({ trait, index, ghostMode }: { trait: TraitCard; index: number; ghostMode: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const catConfig = categoryLabels[trait.category];
  const impactCfg = impactConfig[trait.impact];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left group"
      >
        <div
          className="rounded-2xl border overflow-hidden transition-all duration-300"
          style={{
            background: ghostMode ? 'rgba(18,18,18,0.5)' : 'rgba(255,255,255,0.02)',
            borderColor: expanded
              ? (ghostMode ? 'rgba(160,160,160,0.12)' : `${impactCfg.color}30`)
              : (ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.05)'),
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Main card content */}
          <div className="p-5">
            {/* Top row: icon + title + impact badge */}
            <div className="flex items-start gap-3.5">
              {/* Icon container */}
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0"
                style={{
                  background: ghostMode ? 'rgba(160,160,160,0.05)' : `${catConfig.color}08`,
                  border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${catConfig.color}15`}`,
                }}
              >
                {trait.icon}
              </div>

              {/* Title + category */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3
                    className="text-[16px] font-semibold tracking-tight"
                    style={{ color: ghostMode ? 'rgba(220,220,220,0.8)' : 'rgba(255,255,255,0.92)' }}
                  >
                    {trait.title}
                  </h3>
                  <ImpactBadge impact={trait.impact} ghostMode={ghostMode} />
                </div>
                <p
                  className="text-[11px] mt-0.5 font-medium"
                  style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : `${catConfig.color}60` }}
                >
                  {catConfig.icon} {catConfig.label}
                </p>
              </div>

              {/* Sparkline + chevron */}
              <div className="flex items-center gap-2 shrink-0">
                <MiniSparkline color={impactCfg.color} ghostMode={ghostMode} />
                <motion.div
                  animate={{ rotate: expanded ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M3.5 5.25L7 8.75L10.5 5.25"
                      stroke={ghostMode ? 'rgba(160,160,160,0.25)' : 'rgba(255,255,255,0.2)'}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.div>
              </div>
            </div>

            {/* Summary — the actionable one-liner */}
            <p
              className="text-[13px] leading-[1.65] mt-3.5 pl-[60px]"
              style={{ color: ghostMode ? 'rgba(180,180,180,0.6)' : 'rgba(255,255,255,0.6)' }}
            >
              {trait.summary}
            </p>

            {/* Confidence dots */}
            <div className="mt-3 pl-[60px]">
              <ConfidenceDots value={trait.confidence} color={impactCfg.color} ghostMode={ghostMode} />
            </div>
          </div>

          {/* Expanded details */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div
                  className="px-5 pb-5 pt-4"
                  style={{ borderTop: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)'}` }}
                >
                  {/* Detailed explanation */}
                  <p
                    className="text-[12px] leading-[1.75] mb-4"
                    style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(255,255,255,0.45)' }}
                  >
                    {trait.details}
                  </p>

                  {/* Action items */}
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: ghostMode ? 'rgba(160,160,160,0.4)' : impactCfg.color,
                        boxShadow: ghostMode ? 'none' : `0 0 6px ${impactCfg.color}60`,
                      }}
                    />
                    <span
                      className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                      style={{ color: ghostMode ? 'rgba(160,160,160,0.45)' : impactCfg.color }}
                    >
                      Recommended Actions
                    </span>
                  </div>

                  <ul className="flex flex-col gap-2.5">
                    {trait.actions.map((action, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.06, duration: 0.25 }}
                        className="flex items-start gap-3"
                      >
                        <div
                          className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                          style={{
                            background: ghostMode ? 'rgba(160,160,160,0.06)' : `${impactCfg.color}10`,
                            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${impactCfg.color}18`}`,
                          }}
                        >
                          <span
                            className="text-[8px] font-mono font-bold"
                            style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : impactCfg.color }}
                          >
                            {idx + 1}
                          </span>
                        </div>
                        <span
                          className="text-[12px] leading-[1.6]"
                          style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(255,255,255,0.55)' }}
                        >
                          {action}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </button>
    </motion.div>
  );
}

/* ── Category Section Header ── */
function CategoryHeader({ category, count, ghostMode }: { category: string; count: number; ghostMode: boolean }) {
  const config = categoryLabels[category];
  return (
    <div className="flex items-center gap-3 pt-6 pb-3 first:pt-0">
      <span className="text-lg">{config.icon}</span>
      <h2
        className="text-[14px] font-semibold tracking-tight"
        style={{ color: ghostMode ? 'rgba(200,200,200,0.6)' : config.color }}
      >
        {config.label}
      </h2>
      <div
        className="px-2 py-0.5 rounded-full"
        style={{
          background: ghostMode ? 'rgba(160,160,160,0.06)' : `${config.color}10`,
          border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${config.color}15`}`,
        }}
      >
        <span
          className="text-[9px] font-mono font-semibold"
          style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : `${config.color}90` }}
        >
          {count} traits
        </span>
      </div>
      <div
        className="h-px flex-1"
        style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : `${config.color}10` }}
      />
    </div>
  );
}

/* ── Filter Pill ── */
function FilterPill({
  label,
  active,
  color,
  ghostMode,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  ghostMode: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3.5 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 shrink-0"
      style={{
        background: active
          ? (ghostMode ? 'rgba(160,160,160,0.12)' : `${color}15`)
          : (ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.03)'),
        border: `1px solid ${active
          ? (ghostMode ? 'rgba(160,160,160,0.2)' : `${color}30`)
          : (ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.05)')
        }`,
        color: active
          ? (ghostMode ? 'rgba(200,200,200,0.7)' : color)
          : (ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.35)'),
      }}
    >
      {label}
    </button>
  );
}

/* ── Main BlueprintView ── */
export function BlueprintView({ mounted }: { mounted?: boolean }) {
  const ghostMode = useGhostMode();
  const [activeFilter, setActiveFilter] = useState<'all' | 'dietary' | 'physical' | 'risks'>('all');
  const neon = ghostMode ? 'rgba(160,160,160,' : 'rgba(0,255,204,';

  const filteredTraits = activeFilter === 'all'
    ? traits
    : traits.filter((t) => t.category === activeFilter);

  const categories = activeFilter === 'all'
    ? (['dietary', 'physical', 'risks'] as const)
    : ([activeFilter] as const);

  // Impact summary
  const highCount = traits.filter((t) => t.impact === 'High').length;
  const medCount = traits.filter((t) => t.impact === 'Medium').length;
  const lowCount = traits.filter((t) => t.impact === 'Low').length;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col h-full relative">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="shrink-0 pt-2 pb-4"
      >
        {/* Sync status */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{
              background: ghostMode ? 'rgba(160,160,160,0.4)' : '#34D399',
              boxShadow: ghostMode ? 'none' : '0 0 6px rgba(52,211,153,0.5)',
            }}
          />
          <span
            className="text-[10px] font-mono"
            style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(52,211,153,0.6)' }}
          >
            Genome analysis complete
          </span>
        </div>

        {/* Title */}
        <h1
          className="text-3xl font-bold tracking-tight text-center"
          style={{
            color: ghostMode ? 'rgba(200,200,200,0.7)' : '#00FFCC',
            textShadow: ghostMode ? 'none' : '0 0 30px rgba(0,255,204,0.12)',
          }}
        >
          Your Blueprint
        </h1>
        <p
          className="text-[13px] text-center mt-2 max-w-md mx-auto leading-relaxed"
          style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.4)' }}
        >
          Your genetic traits, explained in plain language with clear, actionable guidance.
        </p>

        {/* Impact summary pills */}
        <div className="flex items-center justify-center gap-4 mt-4">
          {[
            { label: 'High Impact', count: highCount, color: '#F87171' },
            { label: 'Medium', count: medCount, color: '#FBBF24' },
            { label: 'Low', count: lowCount, color: '#34D399' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: ghostMode ? 'rgba(160,160,160,0.25)' : item.color,
                  boxShadow: ghostMode ? 'none' : `0 0 4px ${item.color}40`,
                }}
              />
              <span
                className="text-[10px] font-mono tabular-nums"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.4)' }}
              >
                {item.count} {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Filter pills */}
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          <FilterPill
            label="All Traits"
            active={activeFilter === 'all'}
            color="#00FFCC"
            ghostMode={ghostMode}
            onClick={() => setActiveFilter('all')}
          />
          <FilterPill
            label="🥗 Dietary"
            active={activeFilter === 'dietary'}
            color="#FFB86B"
            ghostMode={ghostMode}
            onClick={() => setActiveFilter('dietary')}
          />
          <FilterPill
            label="⚡ Physical"
            active={activeFilter === 'physical'}
            color="#00FFCC"
            ghostMode={ghostMode}
            onClick={() => setActiveFilter('physical')}
          />
          <FilterPill
            label="🛡️ Risks"
            active={activeFilter === 'risks'}
            color="#FF6BB5"
            ghostMode={ghostMode}
            onClick={() => setActiveFilter('risks')}
          />
        </div>
      </motion.div>

      {/* ── Scrollable card list ── */}
      <div
        className="flex-1 overflow-y-auto min-h-0 px-1 pb-6"
        style={{ scrollbarWidth: 'none' }}
      >
        {categories.map((cat) => {
          const catTraits = filteredTraits.filter((t) => t.category === cat);
          if (catTraits.length === 0) return null;
          return (
            <div key={cat}>
              <CategoryHeader category={cat} count={catTraits.length} ghostMode={ghostMode} />
              <div className="flex flex-col gap-3">
                {catTraits.map((trait, idx) => (
                  <TraitCardComponent
                    key={trait.id}
                    trait={trait}
                    index={idx}
                    ghostMode={ghostMode}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 mb-4 text-center"
        >
          <div
            className="h-px w-16 mx-auto mb-4"
            style={{ background: `${neon}0.1)` }}
          />
          <p
            className="text-[11px] leading-relaxed max-w-sm mx-auto"
            style={{ color: `${neon}0.25)` }}
          >
            Genetic insights are educational and stored in your account when provided. They complement — not replace — professional medical advice. Not HIPAA certified.
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-[9px]">🧬</span>
            <span className="text-[9px] font-mono" style={{ color: `${neon}0.3)` }}>
              10 traits analyzed across 3 categories
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
