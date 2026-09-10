import { useState, useCallback, useMemo } from 'react';
import { getDurationForProtocol } from './ProtocolTimer';
import type { TimerTarget } from './ProtocolTimer';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

/* ═══════════════════════════════════════════════════════════════
   PROTOCOL LIBRARY — Bio-Optimization Templates
   
   Curated protocol templates that users can deploy directly
   into their Daily Mission checklist with one tap.
   ═══════════════════════════════════════════════════════════════ */

interface ProtocolLibraryProps {
  sessionId: string;
  onClose?: () => void;
  onStartTimer?: (target: TimerTarget) => void;
}

interface ProtocolItem {
  name: string;
  category: string;
  icon: string;
  description: string;
  timeOfDay: string;
}

interface ProtocolTemplate {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  color: string;
  tier: 'CORE' | 'ELITE' | 'EXPERIMENTAL';
  category: string;
  duration: string;
  items: ProtocolItem[];
}

/* ── Hardcoded Protocol Templates ── */
const PROTOCOL_TEMPLATES: ProtocolTemplate[] = [
  {
    id: 'sleep-optimization',
    name: 'Sleep Optimization Stack',
    subtitle: 'Magnesium + Theanine + Environment',
    icon: '🌙',
    color: '#6B8AFF',
    tier: 'CORE',
    category: 'recovery',
    duration: 'Nightly',
    items: [
      { name: 'Magnesium Glycinate', category: 'supplement', icon: '🌙', description: '400mg — 30 min before bed for GABA activation', timeOfDay: 'evening' },
      { name: 'L-Theanine', category: 'supplement', icon: '🍵', description: '200mg — promotes alpha brain waves for calm', timeOfDay: 'evening' },
      { name: 'Blue Light Block', category: 'biohacking', icon: '🔴', description: 'Amber glasses 2h before bed — protect melatonin', timeOfDay: 'evening' },
      { name: 'Room Temp 65°F', category: 'recovery', icon: '❄️', description: 'Cool bedroom to 65-68°F for optimal sleep onset', timeOfDay: 'evening' },
      { name: 'No Screens 30min', category: 'recovery', icon: '📵', description: 'Device-free wind-down — read or journal instead', timeOfDay: 'evening' },
    ],
  },
  {
    id: 'cold-exposure-recovery',
    name: 'Cold Exposure Protocol',
    subtitle: 'Deliberate cold for recovery + dopamine',
    icon: '🧊',
    color: '#00CFFF',
    tier: 'ELITE',
    category: 'biohacking',
    duration: 'Daily AM',
    items: [
      { name: 'Cold Plunge 3-5min', category: 'biohacking', icon: '🧊', description: '50-55°F immersion — 2.5x dopamine for 3+ hours', timeOfDay: 'morning' },
      { name: 'Breath Prep', category: 'biohacking', icon: '🌬️', description: '3 rounds Wim Hof breathing before cold entry', timeOfDay: 'morning' },
      { name: 'No Warm Shower After', category: 'recovery', icon: '🚿', description: 'Let body reheat naturally — maximizes brown fat', timeOfDay: 'morning' },
      { name: 'Post-Cold Walk', category: 'movement', icon: '🚶', description: '10 min brisk walk to accelerate rewarming', timeOfDay: 'morning' },
    ],
  },
  {
    id: 'cognitive-performance',
    name: 'Cognitive Performance Stack',
    subtitle: 'Focus + memory + neuroprotection',
    icon: '🧠',
    color: '#D4847A',
    tier: 'ELITE',
    category: 'cognitive',
    duration: 'Daily AM',
    items: [
      { name: 'Lions Mane', category: 'supplement', icon: '🍄', description: '1000mg — NGF stimulation for neuroplasticity', timeOfDay: 'morning' },
      { name: 'Alpha-GPC', category: 'supplement', icon: '⚡', description: '300mg — acetylcholine precursor for focus', timeOfDay: 'morning' },
      { name: 'Creatine 5g', category: 'supplement', icon: '💪', description: 'Brain ATP buffer — 10-15% cognitive boost', timeOfDay: 'morning' },
      { name: 'Morning Sunlight 10min', category: 'biohacking', icon: '☀️', description: 'Cortisol + dopamine spike — sets circadian clock', timeOfDay: 'morning' },
      { name: 'Deep Work Block', category: 'cognitive', icon: '🎯', description: '90 min focused session — no interruptions', timeOfDay: 'morning' },
    ],
  },
  {
    id: 'inflammation-control',
    name: 'Anti-Inflammation Protocol',
    subtitle: 'Reduce CRP + systemic inflammation',
    icon: '🔥',
    color: '#E8976C',
    tier: 'CORE',
    category: 'nutrition',
    duration: 'Daily',
    items: [
      { name: 'Omega-3 Fish Oil', category: 'supplement', icon: '🐟', description: '2g EPA/DHA — resolvin production for inflammation', timeOfDay: 'morning' },
      { name: 'Curcumin + Piperine', category: 'supplement', icon: '🌟', description: '1000mg — NF-κB inhibitor with 2000% absorption boost', timeOfDay: 'morning' },
      { name: 'No Seed Oils', category: 'nutrition', icon: '🚫', description: 'Avoid soybean, canola, sunflower — linoleic acid', timeOfDay: 'all-day' },
      { name: 'Colorful Vegetables', category: 'nutrition', icon: '🥦', description: '5+ servings — polyphenols reduce oxidative stress', timeOfDay: 'all-day' },
    ],
  },
  {
    id: 'testosterone-optimization',
    name: 'Testosterone Optimization',
    subtitle: 'Natural T support through lifestyle + supps',
    icon: '⚔️',
    color: '#C4A46C',
    tier: 'ELITE',
    category: 'supplement',
    duration: 'Daily',
    items: [
      { name: 'Vitamin D3 5000IU', category: 'supplement', icon: '☀️', description: 'Steroid hormone precursor — take with fat', timeOfDay: 'morning' },
      { name: 'Zinc Picolinate 30mg', category: 'supplement', icon: '🔩', description: 'Aromatase inhibitor — prevents T→estrogen', timeOfDay: 'evening' },
      { name: 'Boron 10mg', category: 'supplement', icon: '💎', description: 'Increases free T by reducing SHBG binding', timeOfDay: 'morning' },
      { name: 'Compound Lifts', category: 'training', icon: '🏋️', description: 'Squats/Deadlifts — acute T spike from large muscles', timeOfDay: 'morning' },
      { name: 'Sleep 7-9 Hours', category: 'recovery', icon: '😴', description: 'T production peaks during deep sleep cycles', timeOfDay: 'evening' },
    ],
  },
  {
    id: 'gut-health-reset',
    name: 'Gut Health Reset',
    subtitle: '30-day microbiome restoration protocol',
    icon: '🦠',
    color: '#7CB68E',
    tier: 'CORE',
    category: 'nutrition',
    duration: '30 Days',
    items: [
      { name: 'Probiotic 50B CFU', category: 'supplement', icon: '🦠', description: 'Multi-strain — Lactobacillus + Bifidobacterium', timeOfDay: 'morning' },
      { name: 'Prebiotic Fiber', category: 'nutrition', icon: '🌾', description: '10g from inulin, GOS, or resistant starch', timeOfDay: 'morning' },
      { name: 'Bone Broth', category: 'nutrition', icon: '🍲', description: 'Collagen + glutamine — intestinal lining repair', timeOfDay: 'afternoon' },
      { name: 'No Alcohol', category: 'nutrition', icon: '🚫', description: 'Zero alcohol — gut permeability takes 72h to heal', timeOfDay: 'all-day' },
      { name: 'Fermented Foods', category: 'nutrition', icon: '🥒', description: 'Kimchi, sauerkraut, or kefir — live cultures daily', timeOfDay: 'afternoon' },
    ],
  },
  {
    id: 'zone2-endurance',
    name: 'Zone 2 Endurance Base',
    subtitle: 'Mitochondrial density + fat oxidation',
    icon: '🫀',
    color: '#B8A9C9',
    tier: 'CORE',
    category: 'training',
    duration: '4x/week',
    items: [
      { name: 'Zone 2 Cardio 45min', category: 'training', icon: '🏃', description: '130-150 BPM — conversational pace, nasal breathing', timeOfDay: 'morning' },
      { name: 'Fasted State', category: 'nutrition', icon: '⏰', description: 'Train before first meal — maximize fat oxidation', timeOfDay: 'morning' },
      { name: 'Electrolytes Pre', category: 'supplement', icon: '💧', description: 'Sodium + potassium + magnesium before session', timeOfDay: 'morning' },
      { name: 'HR Monitor Check', category: 'biohacking', icon: '📊', description: 'Stay in Zone 2 — if you can not talk, slow down', timeOfDay: 'morning' },
    ],
  },
  {
    id: 'stress-resilience',
    name: 'Stress Resilience Protocol',
    subtitle: 'Adaptogenic + vagal tone training',
    icon: '🛡️',
    color: '#9B8EC4',
    tier: 'EXPERIMENTAL',
    category: 'recovery',
    duration: 'Daily',
    items: [
      { name: 'Ashwagandha KSM-66', category: 'supplement', icon: '🌿', description: '600mg — cortisol reduction by 30% in 60 days', timeOfDay: 'evening' },
      { name: 'Box Breathing 5min', category: 'recovery', icon: '🌬️', description: '4-4-4-4 pattern — vagal tone upregulation', timeOfDay: 'morning' },
      { name: 'Cold Face Splash', category: 'biohacking', icon: '💦', description: 'Dive reflex activation — instant parasympathetic', timeOfDay: 'morning' },
      { name: 'Gratitude Journal', category: 'cognitive', icon: '📝', description: '3 items — shifts prefrontal cortex activation', timeOfDay: 'evening' },
      { name: 'Nature Walk 20min', category: 'movement', icon: '🌲', description: 'Forest bathing — cortisol drops 12% in 20 min', timeOfDay: 'afternoon' },
    ],
  },
];

const TIER_CONFIG: Record<string, { color: string; label: string; bg: string }> = {
  CORE: { color: '#7CB68E', label: 'CORE', bg: 'rgba(124,182,142,0.08)' },
  ELITE: { color: '#E8976C', label: 'ELITE', bg: 'rgba(232,151,108,0.08)' },
  EXPERIMENTAL: { color: '#9B8EC4', label: 'EXPERIMENTAL', bg: 'rgba(155,142,196,0.08)' },
};

const CATEGORY_FILTER = [
  { id: 'all', label: 'ALL', icon: '⚡' },
  { id: 'recovery', label: 'RECOVERY', icon: '😴' },
  { id: 'supplement', label: 'SUPPS', icon: '💊' },
  { id: 'biohacking', label: 'BIOHACK', icon: '🧬' },
  { id: 'nutrition', label: 'NUTRITION', icon: '🥩' },
  { id: 'training', label: 'TRAINING', icon: '🏋️' },
  { id: 'cognitive', label: 'COGNITIVE', icon: '🧠' },
];

/* ── Template Card ── */
function TemplateCard({
  template,
  onDeploy,
  deploying,
  deployed,
  onStartTimer,
}: {
  template: ProtocolTemplate;
  onDeploy: (t: ProtocolTemplate) => void;
  deploying: boolean;
  deployed: boolean;
  onStartTimer?: (target: TimerTarget) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tier = TIER_CONFIG[template.tier];

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-500"
      style={{
        background: 'rgba(26,24,22,0.7)',
        border: `1px solid ${deployed ? 'rgba(124,182,142,0.2)' : `${template.color}12`}`,
        boxShadow: deployed
          ? `0 0 20px rgba(124,182,142,0.06)`
          : `0 4px 24px rgba(0,0,0,0.2)`,
      }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3.5 flex items-center gap-3 text-left transition-all duration-200 active:scale-[0.99]"
      >
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: `${template.color}10`,
            border: `1px solid ${template.color}20`,
            fontSize: 20,
          }}
        >
          {template.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="text-[12px] font-bold tracking-wide truncate"
              style={{ color: '#E8E0D8', fontFamily: "'Inter', system-ui, sans-serif" }}
            >
              {template.name}
            </span>
            <span
              className="text-[7px] font-mono font-bold tracking-[0.15em] px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{
                color: tier.color,
                background: tier.bg,
                border: `1px solid ${tier.color}20`,
              }}
            >
              {tier.label}
            </span>
          </div>
          <span
            className="text-[9px] font-mono block truncate"
            style={{ color: 'rgba(138,126,114,0.5)' }}
          >
            {template.subtitle}
          </span>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[8px] font-mono" style={{ color: `${template.color}80` }}>
              {template.items.length} protocols
            </span>
            <span className="text-[8px] font-mono" style={{ color: 'rgba(138,126,114,0.35)' }}>
              {template.duration}
            </span>
          </div>
        </div>

        {/* Expand chevron */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(138,126,114,0.3)"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded Items */}
      <div
        style={{
          maxHeight: expanded ? 600 : 0,
          opacity: expanded ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease',
        }}
      >
        <div
          className="px-4 pb-3 space-y-1.5"
          style={{ borderTop: '1px solid rgba(42,38,34,0.4)' }}
        >
          <div className="pt-2.5">
            {template.items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-1"
                style={{
                  background: 'rgba(255,255,255,0.015)',
                  border: '1px solid rgba(42,38,34,0.3)',
                }}
              >
                <span className="text-sm flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <span
                    className="text-[10px] font-semibold tracking-wide block truncate"
                    style={{ color: '#E8E0D8' }}
                  >
                    {item.name}
                  </span>
                  <span
                    className="text-[8px] font-mono block truncate"
                    style={{ color: 'rgba(138,126,114,0.4)' }}
                  >
                    {item.description}
                  </span>
                </div>
                <span
                  className="text-[7px] font-mono tracking-[0.1em] uppercase flex-shrink-0"
                  style={{ color: 'rgba(138,126,114,0.25)' }}
                >
                  {item.timeOfDay}
                </span>
              </div>
            ))}
          </div>

          {/* Deploy Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!deployed && !deploying) onDeploy(template);
            }}
            disabled={deploying || deployed}
            className="w-full py-2.5 rounded-xl font-mono text-[11px] font-bold tracking-[0.1em] uppercase transition-all duration-300 active:scale-[0.97]"
            style={{
              background: deployed
                ? 'rgba(124,182,142,0.08)'
                : deploying
                  ? `${template.color}10`
                  : `${template.color}12`,
              border: `1px solid ${deployed ? 'rgba(124,182,142,0.25)' : `${template.color}25`}`,
              color: deployed ? '#7CB68E' : deploying ? `${template.color}80` : template.color,
              cursor: deployed || deploying ? 'default' : 'pointer',
              boxShadow: deployed
                ? '0 0 12px rgba(124,182,142,0.08)'
                : `0 0 12px ${template.color}08`,
            }}
          >
            {deployed ? '✓ DEPLOYED TO MISSION' : deploying ? '⏳ DEPLOYING...' : '🚀 DEPLOY TO MISSION'}
          </button>

          {/* Start Timer Button — for timed protocols */}
          {deployed && onStartTimer && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Use first item as the timer target
                const item = template.items[0];
                if (!item) return;
                onStartTimer({
                  protocolId: '', // Will be resolved from DB
                  protocolName: template.name,
                  icon: template.icon,
                  category: template.category,
                  durationSeconds: getDurationForProtocol(template.name),
                });
              }}
              className="w-full py-2 rounded-xl font-mono text-[10px] font-bold tracking-[0.1em] uppercase transition-all duration-200 active:scale-[0.97] mt-1.5"
              style={{
                background: `${template.color}08`,
                border: `1px solid ${template.color}18`,
                color: `${template.color}AA`,
              }}
            >
              ⏱ START TIMER
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROTOCOL LIBRARY — Main Component
   ═══════════════════════════════════════════════════════════════ */

export function ProtocolLibrary({ sessionId, onClose, onStartTimer }: ProtocolLibraryProps) {
  const [filter, setFilter] = useState('all');
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [deployedIds, setDeployedIds] = useState<Set<string>>(new Set());
  const [deployResult, setDeployResult] = useState<{ added: number; skipped: number } | null>(null);

  const deployTemplate = useMutation(api.mutations.deployProtocolTemplate);

  const filtered = useMemo(() => {
    if (filter === 'all') return PROTOCOL_TEMPLATES;
    return PROTOCOL_TEMPLATES.filter((t) => t.category === filter);
  }, [filter]);

  const handleDeploy = useCallback(
    async (template: ProtocolTemplate) => {
      if (!sessionId || deployingId) return;
      setDeployingId(template.id);
      setDeployResult(null);
      try {
        const result = await deployTemplate({
          sessionId,
          templateId: template.id,
          items: template.items,
        });
        setDeployedIds((prev) => new Set([...prev, template.id]));
        setDeployResult({ added: result.added, skipped: result.skipped });
        // Clear result after 4s
        setTimeout(() => setDeployResult(null), 4000);
      } catch (err) {
        console.error('Deploy failed:', err);
      } finally {
        setDeployingId(null);
      }
    },
    [sessionId, deployingId, deployTemplate]
  );

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(18,16,14,0.95)',
        border: '1px solid rgba(42,38,34,0.8)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 8px 48px rgba(0,0,0,0.5)',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Header ── */}
      <div
        className="px-5 pt-5 pb-3 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(42,38,34,0.5)' }}
      >
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span style={{ fontSize: 18 }}>📋</span>
            <span
              className="text-[14px] font-bold tracking-[0.08em] uppercase"
              style={{ color: '#E8E0D8', fontFamily: "'Inter', system-ui, sans-serif" }}
            >
              Protocol Library
            </span>
          </div>
          <span
            className="text-[9px] font-mono block pl-[30px]"
            style={{ color: 'rgba(138,126,114,0.45)' }}
          >
            Curated bio-optimization templates — deploy directly to your Daily Mission
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-105"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(42,38,34,0.5)',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(138,126,114,0.5)"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Deploy Result Toast ── */}
      {deployResult && (
        <div
          className="mx-4 mt-3 px-3 py-2 rounded-lg flex items-center gap-2"
          style={{
            background: 'rgba(124,182,142,0.06)',
            border: '1px solid rgba(124,182,142,0.15)',
            animation: 'plFadeIn 0.3s ease',
          }}
        >
          <span style={{ fontSize: 12 }}>✅</span>
          <span className="text-[10px] font-mono" style={{ color: '#7CB68E' }}>
            {deployResult.added} protocol{deployResult.added !== 1 ? 's' : ''} added to Daily Mission
            {deployResult.skipped > 0 && (
              <span style={{ color: 'rgba(196,164,108,0.7)' }}>
                {' '}· {deployResult.skipped} already existed
              </span>
            )}
          </span>
        </div>
      )}

      {/* ── Category Filter ── */}
      <div className="px-4 py-3 flex-shrink-0 overflow-x-auto">
        <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
          {CATEGORY_FILTER.map((cat) => {
            const active = filter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className="px-2.5 py-1.5 rounded-lg text-[8px] font-mono font-bold tracking-[0.12em] uppercase transition-all duration-200 whitespace-nowrap"
                style={{
                  background: active ? 'rgba(232,151,108,0.1)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${active ? 'rgba(232,151,108,0.25)' : 'rgba(42,38,34,0.4)'}`,
                  color: active ? '#E8976C' : 'rgba(138,126,114,0.4)',
                }}
              >
                {cat.icon} {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Template Grid ── */}
      <div
        className="px-4 pb-4 space-y-2.5 overflow-y-auto flex-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-2xl block mb-2">🔍</span>
            <span className="text-[11px] font-semibold block" style={{ color: '#E8E0D8' }}>
              No templates in this category
            </span>
            <span
              className="text-[9px] font-mono block mt-1"
              style={{ color: 'rgba(138,126,114,0.4)' }}
            >
              Try a different filter or check back later
            </span>
          </div>
        ) : (
          filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onDeploy={handleDeploy}
              deploying={deployingId === template.id}
              deployed={deployedIds.has(template.id)}
              onStartTimer={onStartTimer}
            />
          ))
        )}

        {/* Footer */}
        <div className="pt-2 pb-1 text-center">
          <span
            className="text-[8px] font-mono"
            style={{ color: 'rgba(138,126,114,0.25)' }}
          >
            {PROTOCOL_TEMPLATES.length} templates available · Deployed protocols appear in Daily Mission
          </span>
        </div>
      </div>

      {/* Ambient scan line */}
      <div
        className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden"
        style={{ opacity: 0.012 }}
      >
        <div
          className="absolute left-0 w-full h-[1px]"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(232,151,108,0.6), transparent)',
            animation: 'plScanline 10s linear infinite',
          }}
        />
      </div>

      <style>{`
        @keyframes plScanline {
          0% { top: -2%; }
          100% { top: 102%; }
        }
        @keyframes plFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default ProtocolLibrary;
