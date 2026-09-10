import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useSession } from '@/lib/auth-client';
import { useGhostMode } from '@/components/Presence/usePresenceState';
import { generatePrecisionStack } from '@/lib/supplementLogic';
import type { PrecisionFocus, PrecisionItem, PrecisionStack } from '@/lib/supplementLogic';

/* ── Focus mode config ── */
const FOCUS_MODES: { id: PrecisionFocus; label: string; icon: string; color: string; desc: string }[] = [
  { id: 'performance', label: 'Performance', icon: '⚡', color: '#FFB86B', desc: 'Peak power & endurance' },
  { id: 'recovery', label: 'Recovery', icon: '🧘', color: '#00FFCC', desc: 'Rest & repair' },
  { id: 'longevity', label: 'Longevity', icon: '🔬', color: '#AF82FF', desc: 'Cellular renewal' },
];

/* ── Source badge colors ── */
const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  biomarker: { label: 'Blood', color: '#FF6BB5' },
  genetic: { label: 'DNA', color: '#AF82FF' },
  focus: { label: 'Focus', color: '#00FFCC' },
  baseline: { label: 'Base', color: '#6B8AFF' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#FF6B6B', bg: 'rgba(255,107,107,0.1)' },
  recommended: { label: 'Rec', color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
  optional: { label: 'Opt', color: '#6B8AFF', bg: 'rgba(107,138,255,0.1)' },
};

/* ── Stagger variants ── */
const containerVariants = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } },
};

/* ── Single Precision Item Row ── */
function PrecisionRow({ item, ghostMode, focusColor }: { item: PrecisionItem; ghostMode: boolean; focusColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const src = SOURCE_CONFIG[item.source] || SOURCE_CONFIG.baseline;
  const pri = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.optional;

  return (
    <motion.button
      variants={itemVariants}
      layout
      onClick={() => setExpanded(!expanded)}
      className="w-full text-left rounded-xl border overflow-hidden transition-all duration-300 active:scale-[0.98]"
      style={{
        background: expanded ? (ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(10,10,10,0.7)') : 'rgba(10,10,10,0.4)',
        borderColor: expanded
          ? (ghostMode ? 'rgba(160,160,160,0.12)' : `${focusColor}30`)
          : (ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.03)'),
        backdropFilter: 'blur(16px)',
      }}
    >
      <div className="flex items-center gap-3 p-3.5">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: ghostMode ? 'rgba(160,160,160,0.06)' : `${focusColor}10`,
            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${focusColor}20`}`,
          }}
        >
          <span className="text-base">{item.icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[13px] font-medium truncate"
              style={{ color: ghostMode ? 'rgba(200,200,200,0.7)' : 'rgba(255,255,255,0.88)' }}
            >
              {item.name}
            </span>
            <span
              className="text-[7px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{
                color: ghostMode ? 'rgba(160,160,160,0.5)' : pri.color,
                background: ghostMode ? 'rgba(160,160,160,0.06)' : pri.bg,
                border: `0.5px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${pri.color}30`}`,
              }}
            >
              {pri.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="text-[10px] font-mono font-semibold tabular-nums"
              style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : `${focusColor}90` }}
            >
              {item.dose}
            </span>
            <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
            <span
              className="text-[7px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full"
              style={{
                color: ghostMode ? 'rgba(160,160,160,0.4)' : src.color,
                background: ghostMode ? 'rgba(160,160,160,0.04)' : `${src.color}10`,
                border: `0.5px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : `${src.color}20`}`,
              }}
            >
              {src.label}
            </span>
            <span
              className="text-[8px] font-mono"
              style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.25)' }}
            >
              {item.gene}
            </span>
          </div>
        </div>

        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[10px] flex-shrink-0"
          style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.2)' }}
        >
          ▼
        </motion.span>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div
              className="px-3.5 pb-3.5 pt-1"
              style={{ borderTop: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)'}` }}
            >
              <p
                className="text-[11px] font-light leading-relaxed"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(255,255,255,0.45)' }}
              >
                {item.reason}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[8px]">⏰</span>
                <span
                  className="text-[9px] font-mono"
                  style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.3)' }}
                >
                  {item.timing}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT: SupplementProtocol (Precision Stack)
   ══════════════════════════════════════════════════════════════════ */

export function SupplementProtocol() {
  const ghostMode = useGhostMode();
  const [focus, setFocus] = useState<PrecisionFocus>('recovery');

  // Session ID — stable across renders
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('vive-session-id');
      if (!id) { id = crypto.randomUUID(); localStorage.setItem('vive-session-id', id); }
      return id;
    }
    return 'default';
  });

  // Auth session for skip pattern — prevents 'Unauthenticated' crash
  const { data: session } = useSession();

  // ── CONVEX QUERY: Pull Precision Stack from Bio-Vault ──
  const stack = useQuery(api.queries.getPrecisionStack, session ? { sessionId, focus } : 'skip');

  // ── FALLBACK: Generate locally if Convex is unavailable ──
  const localStack = useMemo(() => generatePrecisionStack(null, focus), [focus]);
  const activeStack = stack ?? localStack;

  const focusConfig = FOCUS_MODES.find(f => f.id === focus) || FOCUS_MODES[1];
  const focusColor = ghostMode ? 'rgba(160,160,160,0.6)' : focusConfig.color;
  const neon = ghostMode ? 'rgba(160,160,160,' : 'rgba(0,255,204,';

  // Group items by source for summary pills
  const sourceGroups = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const item of activeStack.items) {
      groups[item.source] = (groups[item.source] || 0) + 1;
    }
    return groups;
  }, [activeStack.items]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="relative overflow-hidden rounded-2xl border"
      style={{
        background: 'rgba(8,8,8,0.7)',
        borderColor: ghostMode ? 'rgba(160,160,160,0.06)' : `${focusConfig.color}15`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {!ghostMode && (
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${focusConfig.color}06 0%, transparent 40%, ${focusConfig.color}03 100%)`,
          }}
        />
      )}

      <div className="relative z-10 p-5">
        {/* ── Header ── */}
        <motion.div variants={itemVariants} className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: ghostMode ? 'rgba(160,160,160,0.06)' : `${focusConfig.color}12`,
                border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${focusConfig.color}25`}`,
              }}
            >
              <span className="text-sm">🧬</span>
            </div>
            <div>
              <h3
                className="text-sm font-semibold tracking-tight"
                style={{ color: ghostMode ? 'rgba(200,200,200,0.8)' : 'rgba(255,255,255,0.9)' }}
              >
                Precision Stack
              </h3>
              <p
                className="text-[9px] font-mono uppercase tracking-wider"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : `${focusConfig.color}70` }}
              >
                {activeStack.tier === 'personalized' ? 'Bio-Vault Personalized' : 'Baseline Protocol'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeStack.criticalCount > 0 && (
              <span
                className="text-[8px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  color: ghostMode ? 'rgba(160,160,160,0.5)' : '#FF6B6B',
                  background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,107,107,0.1)',
                  border: `0.5px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : 'rgba(255,107,107,0.2)'}`,
                }}
              >
                {activeStack.criticalCount} critical
              </span>
            )}
            <span
              className="text-[10px] font-mono tabular-nums"
              style={{ color: ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.3)' }}
            >
              {activeStack.totalItems} items
            </span>
          </div>
        </motion.div>

        {/* ── Focus Selector ── */}
        <motion.div variants={itemVariants} className="flex gap-2 mb-4">
          {FOCUS_MODES.map((mode) => {
            const isActive = focus === mode.id;
            const modeColor = ghostMode ? 'rgba(160,160,160,0.6)' : mode.color;
            return (
              <button
                key={mode.id}
                onClick={() => setFocus(mode.id)}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl transition-all duration-300 min-h-[44px]"
                style={{
                  background: isActive
                    ? (ghostMode ? 'rgba(160,160,160,0.08)' : `${mode.color}10`)
                    : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isActive
                    ? (ghostMode ? 'rgba(160,160,160,0.15)' : `${mode.color}30`)
                    : 'rgba(255,255,255,0.04)'}`,
                  boxShadow: isActive && !ghostMode ? `0 0 16px ${mode.color}15, inset 0 0 12px ${mode.color}08` : 'none',
                }}
              >
                <span className="text-base">{mode.icon}</span>
                <span
                  className="text-[9px] font-mono uppercase tracking-wider font-semibold"
                  style={{ color: isActive ? modeColor : (ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.3)') }}
                >
                  {mode.label}
                </span>
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[7px] font-light"
                    style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : `${mode.color}60` }}
                  >
                    {mode.desc}
                  </motion.span>
                )}
              </button>
            );
          })}
        </motion.div>

        {/* ── Data Completeness Strip ── */}
        <motion.div variants={itemVariants} className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-[8px] font-mono uppercase tracking-wider"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : `${focusConfig.color}50` }}
              >
                {activeStack.tier === 'personalized' ? '🧬 Personalized' : '📋 Baseline'}
              </span>
              <span
                className="text-[8px] font-mono tabular-nums"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.25)' }}
              >
                {activeStack.dataCompleteness}% vault data
              </span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${activeStack.dataCompleteness}%` }}
                transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  background: ghostMode
                    ? 'rgba(160,160,160,0.3)'
                    : `linear-gradient(90deg, ${focusConfig.color}, ${focusConfig.color}80)`,
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1">
            {Object.entries(sourceGroups).map(([source, count]) => {
              const cfg = SOURCE_CONFIG[source] || SOURCE_CONFIG.baseline;
              return (
                <span
                  key={source}
                  className="text-[7px] font-mono px-1.5 py-0.5 rounded-full"
                  style={{
                    color: ghostMode ? 'rgba(160,160,160,0.4)' : cfg.color,
                    background: ghostMode ? 'rgba(160,160,160,0.04)' : `${cfg.color}10`,
                    border: `0.5px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : `${cfg.color}18`}`,
                  }}
                >
                  {count} {cfg.label}
                </span>
              );
            })}
          </div>
        </motion.div>

        {/* ── Supplement List ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={focus}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-2"
          >
            {activeStack.items.map((item) => (
              <PrecisionRow
                key={item.id}
                item={item}
                ghostMode={ghostMode}
                focusColor={focusColor}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* ── Footer ── */}
        <motion.div variants={itemVariants} className="flex flex-col items-center gap-1.5 pt-4 mt-4"
          style={{ borderTop: `1px solid ${ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.03)'}` }}
        >
          <p
            className="text-[8px] font-mono uppercase tracking-[0.15em] text-center"
            style={{ color: `${neon}0.2)` }}
          >
            {activeStack.tier === 'personalized'
              ? 'Formulated from your Bio-Vault \u00B7 Gene-pathway optimized'
              : 'Add blood panels in Health Records for gene-specific dosing'}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default SupplementProtocol;
