import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';

/* ═══════════════════════════════════════════════════════════════
   PROTOCOL TRACKER — Daily Health Task Checklist
   
   Interactive checklist for personalized daily protocols.
   Completions sync in real-time and feed into Elite Score.
   ═══════════════════════════════════════════════════════════════ */

interface ProtocolTrackerProps {
  sessionId: string;
  compact?: boolean;
}

/* ── Category Colors ── */
const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  supplement: { bg: 'rgba(0,240,255,0.06)', border: 'rgba(0,240,255,0.12)', text: 'rgba(0,240,255,0.9)', dot: '#00F0FF' },
  recovery: { bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.12)', text: 'rgba(52,211,153,0.9)', dot: '#34D399' },
  movement: { bg: 'rgba(255,149,0,0.06)', border: 'rgba(255,149,0,0.12)', text: 'rgba(255,149,0,0.9)', dot: '#FF9500' },
  nutrition: { bg: 'rgba(255,214,10,0.06)', border: 'rgba(255,214,10,0.12)', text: 'rgba(255,214,10,0.9)', dot: '#FFD60A' },
};

const getCategoryStyle = (category: string) =>
  CATEGORY_COLORS[category] || CATEGORY_COLORS.supplement;

/* ── Time of Day Labels ── */
const TIME_LABELS: Record<string, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  'all-day': 'All Day',
};

export function ProtocolTracker({ sessionId, compact = false }: ProtocolTrackerProps) {
  const protocolStatus = useQuery(api.protocols.getTodayProtocolStatus, { sessionId });
  const aiSuggestions = useQuery(api.protocols.getAISuggestions, { sessionId });
  const toggleCompletion = useMutation(api.protocols.toggleCompletion);
  const seedDefaults = useMutation(api.protocols.seedDefaults);
  const createProtocol = useMutation(api.protocols.createProtocol);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addingSuggestion, setAddingSuggestion] = useState<string | null>(null);

  // Seed defaults if user has no protocols
  useEffect(() => {
    if (protocolStatus && protocolStatus.total === 0) {
      seedDefaults({ sessionId });
    }
  }, [protocolStatus?.total, sessionId, seedDefaults]);

  const handleToggle = useCallback(async (protocolId: Id<"protocols">) => {
    setTogglingId(protocolId);
    try {
      const result = await toggleCompletion({ sessionId, protocolId });
      if (result.completed) {
        setJustCompleted((prev) => new Set([...prev, protocolId]));
        setTimeout(() => {
          setJustCompleted((prev) => {
            const next = new Set(prev);
            next.delete(protocolId);
            return next;
          });
        }, 1500);
      }
    } finally {
      setTogglingId(null);
    }
  }, [sessionId, toggleCompletion]);

  const handleAddSuggestion = useCallback(async (suggestion: {
    name: string;
    category: string;
    icon: string;
    description: string;
    timeOfDay: string;
  }) => {
    setAddingSuggestion(suggestion.name);
    try {
      await createProtocol({
        sessionId,
        name: suggestion.name,
        category: suggestion.category,
        icon: suggestion.icon,
        description: suggestion.description,
        timeOfDay: suggestion.timeOfDay,
        source: "ai",
      });
    } finally {
      setAddingSuggestion(null);
    }
  }, [sessionId, createProtocol]);

  if (!protocolStatus) {
    return (
      <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(0,240,255,0.3)', borderTopColor: 'transparent' }} />
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading protocols...</span>
        </div>
      </div>
    );
  }

  const { items, total, done, percentage } = protocolStatus;

  // Group by time of day
  const grouped = {
    morning: items.filter((i) => i.timeOfDay === 'morning'),
    afternoon: items.filter((i) => i.timeOfDay === 'afternoon'),
    evening: items.filter((i) => i.timeOfDay === 'evening'),
    'all-day': items.filter((i) => i.timeOfDay === 'all-day'),
  };

  const timeGroups = Object.entries(grouped).filter(([_, items]) => items.length > 0);

  /* ── Compact Mode (for dashboard card) ── */
  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        {/* Progress Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Daily Protocol
            </span>
            <span className="text-[10px] font-mono" style={{ color: percentage === 100 ? 'rgba(52,211,153,0.9)' : 'rgba(0,240,255,0.6)' }}>
              {done}/{total}
            </span>
          </div>
          <span className="text-[10px] font-bold" style={{ color: percentage === 100 ? '#34D399' : '#00F0FF' }}>
            {percentage}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{
              background: percentage === 100
                ? 'linear-gradient(90deg, #34D399, #10B981)'
                : 'linear-gradient(90deg, #00F0FF, #00CCDD)',
            }}
            initial={{ width: '0%' }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>

        {/* Compact List */}
        <div className="flex flex-col gap-1">
          {items.slice(0, 5).map((item) => (
            <button
              key={item._id}
              onClick={() => handleToggle(item._id as Id<"protocols">)}
              disabled={togglingId === item._id}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 active:scale-[0.98]"
              style={{
                background: item.completed ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.015)',
              }}
            >
              {/* Checkbox */}
              <div
                className="w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-300"
                style={{
                  background: item.completed ? 'rgba(52,211,153,0.15)' : 'transparent',
                  border: `1.5px solid ${item.completed ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.12)'}`,
                }}
              >
                <AnimatePresence>
                  {item.completed && (
                    <motion.svg
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </motion.svg>
                  )}
                </AnimatePresence>
              </div>

              <span className="text-[10px]" style={{ marginRight: 2 }}>{item.icon}</span>
              <span
                className="text-[11px] font-medium flex-1 text-left transition-all duration-300"
                style={{
                  color: item.completed ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)',
                  textDecoration: item.completed ? 'line-through' : 'none',
                }}
              >
                {item.name}
              </span>

              {togglingId === item._id && (
                <div className="w-3 h-3 rounded-full border-[1.5px] border-t-transparent animate-spin" style={{ borderColor: 'rgba(0,240,255,0.4)', borderTopColor: 'transparent' }} />
              )}
            </button>
          ))}
          {items.length > 5 && (
            <span className="text-[9px] font-mono px-2.5 py-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
              +{items.length - 5} more protocols
            </span>
          )}
        </div>
      </div>
    );
  }

  /* ── Full Mode (for dedicated view) ── */
  return (
    <div className="flex flex-col gap-4">
      {/* ── Header with Progress Ring ── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          {/* Mini Progress Ring */}
          <div className="relative w-11 h-11">
            <svg width="44" height="44" viewBox="0 0 44 44" className="transform -rotate-90">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="3" />
              <motion.circle
                cx="22" cy="22" r="18" fill="none"
                stroke={percentage === 100 ? '#34D399' : '#00F0FF'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 18}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 18 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 18 * (1 - percentage / 100) }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-bold" style={{ color: percentage === 100 ? '#34D399' : '#00F0FF' }}>
                {percentage}%
              </span>
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-[13px] font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.9)' }}>
              Daily Protocol
            </span>
            <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {done} of {total} completed
            </span>
          </div>
        </div>

        {/* Score Impact Badge */}
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{
            background: percentage > 0 ? 'rgba(0,240,255,0.06)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${percentage > 0 ? 'rgba(0,240,255,0.12)' : 'rgba(255,255,255,0.04)'}`,
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={percentage > 0 ? '#00F0FF' : 'rgba(255,255,255,0.2)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span className="text-[9px] font-bold" style={{ color: percentage > 0 ? 'rgba(0,240,255,0.8)' : 'rgba(255,255,255,0.2)' }}>
              +{Math.round(percentage * 0.25)} pts
            </span>
          </div>
          <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>
            Elite Score impact
          </span>
        </div>
      </div>

      {/* ── Protocol List by Time of Day ── */}
      <div className="flex flex-col gap-3">
        {timeGroups.map(([timeKey, groupItems], groupIdx) => (
          <motion.div
            key={timeKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: groupIdx * 0.05, duration: 0.3 }}
          >
            {/* Time Label */}
            <div className="flex items-center gap-2 px-1 mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                {TIME_LABELS[timeKey] || timeKey}
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.03)' }} />
            </div>

            {/* Protocol Items */}
            <div className="flex flex-col gap-1">
              {groupItems.map((item, idx) => {
                const catStyle = getCategoryStyle(item.category);
                const isToggling = togglingId === item._id;
                const wasJustCompleted = justCompleted.has(item._id);

                return (
                  <motion.button
                    key={item._id}
                    onClick={() => handleToggle(item._id as Id<"protocols">)}
                    disabled={isToggling}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: groupIdx * 0.05 + idx * 0.03, duration: 0.25 }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98]"
                    style={{
                      background: item.completed
                        ? 'rgba(52,211,153,0.03)'
                        : 'rgba(255,255,255,0.015)',
                      border: `1px solid ${item.completed ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.04)'}`,
                    }}
                  >
                    {/* Animated Checkbox */}
                    <div
                      className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300"
                      style={{
                        background: item.completed ? 'rgba(52,211,153,0.15)' : 'transparent',
                        border: `1.5px solid ${item.completed ? 'rgba(52,211,153,0.5)' : 'rgba(255,255,255,0.12)'}`,
                        boxShadow: wasJustCompleted ? '0 0 12px rgba(52,211,153,0.3)' : 'none',
                      }}
                    >
                      <AnimatePresence>
                        {item.completed && (
                          <motion.svg
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                          >
                            <path d="M20 6L9 17l-5-5" />
                          </motion.svg>
                        )}
                      </AnimatePresence>
                      {isToggling && (
                        <div className="w-3 h-3 rounded-full border-[1.5px] border-t-transparent animate-spin" style={{ borderColor: 'rgba(0,240,255,0.4)', borderTopColor: 'transparent' }} />
                      )}
                    </div>

                    {/* Icon */}
                    <span className="text-[13px] flex-shrink-0">{item.icon}</span>

                    {/* Content */}
                    <div className="flex flex-col flex-1 text-left min-w-0">
                      <span
                        className="text-[12px] font-semibold transition-all duration-300 truncate"
                        style={{
                          color: item.completed ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.85)',
                          textDecoration: item.completed ? 'line-through' : 'none',
                        }}
                      >
                        {item.name}
                      </span>
                      <span
                        className="text-[10px] truncate transition-all duration-300"
                        style={{ color: item.completed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.35)' }}
                      >
                        {item.description}
                      </span>
                    </div>

                    {/* Category Pill */}
                    <div
                      className="flex-shrink-0 px-2 py-0.5 rounded-full"
                      style={{ background: catStyle.bg, border: `1px solid ${catStyle.border}` }}
                    >
                      <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: catStyle.text }}>
                        {item.category}
                      </span>
                    </div>

                    {/* Completion Flash */}
                    <AnimatePresence>
                      {wasJustCompleted && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="flex-shrink-0"
                        >
                          <span className="text-[10px]">&#x2728;</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── AI Suggestions Section ── */}
      {aiSuggestions && aiSuggestions.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <button
            onClick={() => setShowSuggestions(!showSuggestions)}
            className="flex items-center gap-2 px-1 transition-all duration-200"
          >
            <div className="w-4 h-4 rounded-md flex items-center justify-center" style={{ background: 'rgba(0,240,255,0.08)', border: '1px solid rgba(0,240,255,0.15)' }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#00F0FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <span className="text-[10px] font-semibold tracking-wide" style={{ color: 'rgba(0,240,255,0.7)' }}>
              AI Suggestions
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,240,255,0.06)', color: 'rgba(0,240,255,0.5)' }}>
              {aiSuggestions.length}
            </span>
            <div className="flex-1" />
            <motion.svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              animate={{ rotate: showSuggestions ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path d="m6 9 6 6 6-6" />
            </motion.svg>
          </button>

          <AnimatePresence>
            {showSuggestions && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-1.5">
                  {aiSuggestions.map((suggestion, idx) => (
                    <motion.div
                      key={suggestion.name}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.2 }}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                      style={{
                        background: 'rgba(0,240,255,0.02)',
                        border: '1px solid rgba(0,240,255,0.06)',
                      }}
                    >
                      <span className="text-[13px] flex-shrink-0 mt-0.5">{suggestion.icon}</span>
                      <div className="flex flex-col flex-1 min-w-0 gap-0.5">
                        <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>
                          {suggestion.name}
                        </span>
                        <span className="text-[9px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                          {suggestion.reason}
                        </span>
                      </div>
                      <button
                        onClick={() => handleAddSuggestion(suggestion)}
                        disabled={addingSuggestion === suggestion.name}
                        className="flex-shrink-0 px-2.5 py-1 rounded-lg transition-all duration-200 active:scale-95"
                        style={{
                          background: 'rgba(0,240,255,0.08)',
                          border: '1px solid rgba(0,240,255,0.15)',
                        }}
                      >
                        {addingSuggestion === suggestion.name ? (
                          <div className="w-3 h-3 rounded-full border-[1.5px] border-t-transparent animate-spin" style={{ borderColor: 'rgba(0,240,255,0.4)', borderTopColor: 'transparent' }} />
                        ) : (
                          <span className="text-[9px] font-bold" style={{ color: 'rgba(0,240,255,0.8)' }}>+ Add</span>
                        )}
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Completion Celebration ── */}
      <AnimatePresence>
        {percentage === 100 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(52,211,153,0.06), rgba(16,185,129,0.03))',
              border: '1px solid rgba(52,211,153,0.15)',
            }}
          >
            <span className="text-[16px]">&#x1F3C6;</span>
            <div className="flex flex-col flex-1">
              <span className="text-[11px] font-bold" style={{ color: 'rgba(52,211,153,0.9)' }}>
                All Protocols Complete
              </span>
              <span className="text-[9px]" style={{ color: 'rgba(52,211,153,0.5)' }}>
                +25 points added to your Elite Score
              </span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: 'rgba(52,211,153,0.1)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span className="text-[9px] font-bold" style={{ color: '#34D399' }}>100%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
