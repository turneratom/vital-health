import { useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGhostMode } from '@/components/Presence/usePresenceState';
import { useAnalytics } from '@/lib/useAnalytics';

interface ActionItem {
  id: string;
  label: string;
  sublabel: string;
  emoji: string;
  color: string;
  priority?: boolean;
}

const defaultActions: ActionItem[] = [
  { id: 'food', label: 'Log a Meal', sublabel: 'What did you eat?', emoji: '🍽️', color: '#E8976C' },
  { id: 'activity', label: 'Log a Walk', sublabel: 'Track your movement', emoji: '🚶', color: '#7CB68E' },
  { id: 'vitals', label: 'Check Health', sublabel: 'See how you\'re doing', emoji: '❤️', color: '#D4847A' },
  { id: 'blueprint', label: 'My Plan', sublabel: 'Today\'s daily plan', emoji: '📋', color: '#6BA3BE' },
];

interface ActionTileProps {
  item: ActionItem;
  onSelect?: (id: string) => void;
  onHesitation?: (id: string, label: string) => void;
  index: number;
}

function ActionTile({ item, onSelect, onHesitation, index }: ActionTileProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ghostMode = useGhostMode();

  const isPriority = item.priority && !ghostMode;
  const baseColor = ghostMode ? '160,160,160' : item.color.replace('#', '').match(/.{2}/g)?.map(h => parseInt(h, 16)).join(',') || '232,151,108';

  const handleMouseEnter = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      onHesitation?.(item.id, item.label);
    }, 3000);
  }, [item.id, item.label, onHesitation]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    onSelect?.(item.id);
  }, [item.id, onSelect]);

  return (
    <motion.button
      ref={ref}
      onClick={handleClick}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className="group relative flex items-center gap-4 w-full rounded-2xl border overflow-hidden text-left transition-all duration-300"
      style={{
        background: ghostMode
          ? 'rgba(160,160,160,0.04)'
          : `rgba(${baseColor}, 0.04)`,
        borderColor: ghostMode
          ? 'rgba(160,160,160,0.08)'
          : isPriority
            ? `rgba(${baseColor}, 0.2)`
            : `rgba(${baseColor}, 0.1)`,
        padding: '18px 20px',
        boxShadow: isPriority
          ? `0 0 16px rgba(${baseColor}, 0.06)`
          : 'none',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Large emoji */}
      <span
        className="flex-shrink-0 flex items-center justify-center rounded-xl"
        style={{
          width: 56,
          height: 56,
          fontSize: '28px',
          background: ghostMode
            ? 'rgba(160,160,160,0.06)'
            : `rgba(${baseColor}, 0.08)`,
          border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `rgba(${baseColor}, 0.12)`}`,
        }}
      >
        {item.emoji}
      </span>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <span
          className="block font-semibold text-base"
          style={{
            color: ghostMode ? 'rgba(200,200,200,0.8)' : 'rgba(232, 224, 216, 0.92)',
            fontFamily: 'Inter, system-ui, sans-serif',
            letterSpacing: '-0.01em',
          }}
        >
          {item.label}
        </span>
        <span
          className="block text-sm mt-0.5"
          style={{
            color: ghostMode ? 'rgba(160,160,160,0.4)' : `rgba(${baseColor}, 0.55)`,
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {item.sublabel}
        </span>
      </div>

      {/* Arrow */}
      <svg
        width="20" height="20" viewBox="0 0 20 20" fill="none"
        className="flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1"
        style={{ opacity: ghostMode ? 0.2 : 0.35 }}
      >
        <path d="M7 4L13 10L7 16" stroke={ghostMode ? '#999' : item.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Priority badge */}
      {isPriority && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-3 right-3 px-2 py-0.5 rounded-full"
          style={{
            background: `rgba(${baseColor}, 0.12)`,
            border: `1px solid rgba(${baseColor}, 0.2)`,
          }}
        >
          <span className="text-[10px] font-semibold" style={{ color: item.color }}>
            Suggested
          </span>
        </motion.div>
      )}
    </motion.button>
  );
}

interface ActionHubProps {
  onSelect?: (id: string) => void;
  priorityAction?: string | null;
}

export function ActionHub({ onSelect, priorityAction }: ActionHubProps) {
  const ghostMode = useGhostMode();
  const { trackNavHesitation } = useAnalytics();

  const actions = defaultActions.map((a) => ({
    ...a,
    priority: priorityAction === a.id,
  }));

  if (priorityAction) {
    const priorityIdx = actions.findIndex((a) => a.id === priorityAction);
    if (priorityIdx > 0) {
      const [item] = actions.splice(priorityIdx, 1);
      actions.unshift(item);
    }
  }

  const handleHesitation = useCallback((buttonId: string, buttonLabel: string) => {
    trackNavHesitation(buttonId, buttonLabel);
  }, [trackNavHesitation]);

  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center gap-3 px-1">
        <span
          className="text-sm font-semibold"
          style={{
            color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(232, 151, 108, 0.55)',
            fontFamily: 'Inter, system-ui, sans-serif',
            letterSpacing: '0.01em',
          }}
        >
          Quick Actions
        </span>
        <div
          className="flex-1 h-px"
          style={{
            background: ghostMode
              ? 'linear-gradient(90deg, rgba(160,160,160,0.1), transparent)'
              : 'linear-gradient(90deg, rgba(232, 151, 108, 0.12), transparent)',
          }}
        />
      </div>

      {/* Action buttons — stacked vertically for clarity */}
      <div className="flex flex-col gap-2.5 w-full">
        {actions.map((a, i) => (
          <ActionTile key={a.id} item={a} onSelect={onSelect} onHesitation={handleHesitation} index={i} />
        ))}
      </div>
    </div>
  );
}

export default ActionHub;
