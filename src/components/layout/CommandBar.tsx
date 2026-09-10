import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAction, useMutation, useQuery } from 'convex/react';
import { getTwinSessionId } from '@/lib/twinSession';
import { api } from '../../../convex/_generated/api';
import type { ViewId } from './ViewManager';

/* ═══════════════════════════════════════════════════════════════
   COMMAND BAR — Zero-Friction Cmd+K Quick Navigation + Quick-Log
   
   Spotlight-style command palette with two modes:
   1. NAVIGATE — instant navigation between views (default)
   2. QUICK-LOG — natural language health entry parsing
      Type "took 500mg magnesium", "slept 8 hours", "hrv 62"
      AI Brain parses → triggers corresponding mutation
      → dispatches SomaticMirror body-region pulse
      User never leaves the main canvas.
   
   ZERO-FRICTION FEATURES:
   - Auto-detects quick-log intent from first keystroke
   - Dosage-aware parsing ("500mg magnesium", "5000 IU vitamin d")
   - BioVault sync for sleep/HRV entries (not just journal events)
   - SomaticMirror pulse dispatch on successful log
   - Pending protocol one-tap completion
   - 1.8s auto-dismiss with body-region confirmation
   ═══════════════════════════════════════════════════════════════ */

interface CommandItem {
  id: ViewId | '__quicklog' | '__connections' | '__morningbrief' | '__visitpacket';
  label: string;
  description: string;
  icon: string;
  category: 'core' | 'health' | 'insights' | 'social' | 'actions';
  keywords: string[];
  isAction?: boolean;
}

const COMMAND_ITEMS: CommandItem[] = [
  { id: 'dashboard', label: 'Command Center', description: 'Main dashboard overview', icon: '⬡', category: 'core', keywords: ['home', 'main', 'overview', 'dashboard'] },
  { id: 'briefing', label: 'Briefing Room', description: 'AI brief & coaching chat', icon: '◉', category: 'core', keywords: ['ai', 'brief', 'chat', 'coach', 'ask'] },
  { id: 'protocols', label: 'Daily Protocols', description: 'Health task checklist', icon: '✦', category: 'core', keywords: ['protocol', 'tasks', 'checklist', 'habits', 'routine'] },
  { id: 'biovault', label: 'Bio-Vault', description: 'Health resume & trends', icon: '◈', category: 'core', keywords: ['vault', 'bio', 'trends', 'history', 'resume', 'records'] },
  { id: 'journal', label: 'Journal', description: 'Food, water & exercise logs', icon: '◎', category: 'health', keywords: ['journal', 'log', 'food', 'water', 'meal', 'exercise'] },
  { id: 'vitals', label: 'Vitals', description: 'Biometric data & HRV', icon: '♡', category: 'health', keywords: ['vitals', 'hrv', 'heart', 'biometrics', 'health'] },
  { id: 'nutrition', label: 'Nutrition', description: 'Macros & meal planning', icon: '◐', category: 'health', keywords: ['nutrition', 'macros', 'calories', 'diet', 'food'] },
  { id: 'activity', label: 'Activity', description: 'Workouts & movement', icon: '△', category: 'health', keywords: ['activity', 'workout', 'exercise', 'movement', 'training'] },
  { id: 'progress', label: 'Progress', description: 'Weight & body composition', icon: '▲', category: 'insights', keywords: ['progress', 'weight', 'body', 'composition', 'goals'] },
  { id: 'dna', label: 'DNA Insights', description: 'Genetic analysis', icon: '⧬', category: 'insights', keywords: ['dna', 'genetic', 'genes', 'genome'] },
  { id: 'biometrics', label: 'Biometrics', description: 'Detailed bio readings', icon: '◇', category: 'insights', keywords: ['biometrics', 'readings', 'data', 'metrics'] },
  { id: 'milestones', label: 'Milestones', description: 'Achievements & records', icon: '★', category: 'insights', keywords: ['milestones', 'achievements', 'records', 'personal best'] },
  { id: 'report', label: 'Weekly Report', description: 'Performance summary & trends', icon: '◆', category: 'insights', keywords: ['report', 'weekly', 'summary', 'review'] },
  { id: 'community', label: 'Community', description: 'Network & leaderboard', icon: '◬', category: 'social', keywords: ['community', 'social', 'network', 'leaderboard', 'friends'] },
  { id: 'blueprint', label: 'Blueprint', description: 'Protocol builder', icon: '⬢', category: 'social', keywords: ['blueprint', 'protocol', 'builder', 'plan'] },
  { id: '__morningbrief' as any, label: 'Morning Brief', description: 'Open daily directives & protocol brief (home)', icon: '☀', category: 'actions', keywords: ['morning', 'brief', 'directives', 'daily', 'home', 'protocol', 'today'], isAction: true },
  { id: '__visitpacket' as any, label: 'Doctor Visit Prep', description: 'Export visit packet (JSON / printable) from Bio-Resume', icon: '📋', category: 'actions', keywords: ['doctor', 'visit', 'packet', 'export', 'prep', 'bio resume', 'json', 'pdf', 'report', 'clinic'], isAction: true },
  { id: '__quicklog' as any, label: 'Manual Vitals / Quick Log', description: 'Enter HR, HRV, sleep, steps (wearables coming later)', icon: '⚡', category: 'actions', keywords: ['log', 'vitals', 'quick log', 'quick', 'entry', 'record', 'track', 'hr', 'hrv', 'sleep', 'mood', 'energy', 'manual', 'steps'], isAction: true },
  { id: '__connections' as any, label: 'Connections & Manual Vitals', description: 'Wearable status + manual vitals form', icon: '⬡', category: 'actions', keywords: ['connections', 'wearable', 'oura', 'whoop', 'apple', 'garmin', 'manual vitals', 'settings'], isAction: true },
];

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core',
  health: 'Health',
  insights: 'Insights',
  social: 'Social',
  actions: 'Quick Actions',
};

/* ── Quick-Log result feedback with body region ── */
interface QuickLogResult {
  type: 'success' | 'error' | 'parsing';
  icon: string;
  label: string;
  detail: string;
  bodyRegion?: string; // SomaticMirror region that was affected
  dosage?: string;     // Dosage info for confirmation
}

/* ── Body region mapping for SomaticMirror pulse ── */
const CATEGORY_TO_BODY_REGION: Record<string, string> = {
  supplement: 'metabolic',
  biohacking: 'neural',
  recovery: 'nervous',
  training: 'musculature',
  movement: 'musculature',
  nutrition: 'digestive',
  vital_hrv: 'nervous',
  vital_hr: 'nervous',
  vital_sleep: 'neural',
  vital_spo2: 'nervous',
  vital_temp: 'metabolic',
  mood: 'neural',
};

/* ── Quick-Log hint suggestions ── */
const QUICK_LOG_HINTS = [
  { text: 'took 500mg magnesium', icon: '💊' },
  { text: 'slept 8 hours', icon: '😴' },
  { text: 'hrv 62', icon: '♡' },
  { text: 'cold plunge done', icon: '❄️' },
  { text: 'mood 4 energy 5', icon: '⚡' },
  { text: 'took 5000 IU vitamin d', icon: '☀️' },
  { text: 'heart rate 58', icon: '❤️' },
  { text: 'ran 3 miles', icon: '🏃' },
];

/* ── Auto-detect if input looks like a quick-log entry ── */
const QUICKLOG_TRIGGER_PATTERNS = [
  /^(?:took|had|did|finished|completed|logged|ate|drank|ran|walked|slept|sleep)\s/i,
  /^(?:hrv|hr|spo2|heart\s*rate|rhr|temp|mood|energy)\s*[:=]?\s*\d/i,
  /^\d+(?:\.\d+)?\s*(?:mg|iu|mcg|g|ml|hours?|hrs?|h|bpm|ms)\b/i,
  /^(?:feeling|felt)\s/i,
  /^(?:cold|sauna|sunlight|meditation|breathwork|cardio|weights|yoga)/i,
  /^(?:creatine|magnesium|omega|fish\s*oil|vitamin|zinc|iron|ashwagandha)/i,
];

function looksLikeQuickLog(input: string): boolean {
  if (!input.trim()) return false;
  return QUICKLOG_TRIGGER_PATTERNS.some(p => p.test(input.trim()));
}

interface CommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewId) => void;
  activeView: ViewId;
  onOpenQuickLog?: () => void;
  sessionId?: string;
  onSomaticPulse?: (region: string, category: string) => void;
}

export function CommandBar({ isOpen, onClose, onNavigate, activeView, onOpenQuickLog, sessionId, onSomaticPulse }: CommandBarProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<'navigate' | 'quicklog'>('navigate');
  const [quickLogResult, setQuickLogResult] = useState<QuickLogResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recentLogs, setRecentLogs] = useState<Array<{ icon: string; label: string; time: number }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sid = sessionId || (typeof window !== 'undefined' ? getTwinSessionId() : 'ssr');

  // Convex mutations for quick-log
  const logVital = useMutation(api.quickLog.logVital);
  const logMoodEnergy = useMutation(api.quickLog.logMoodEnergy);
  const protocolStatus = useQuery(api.protocols.getTodayProtocolStatus, { sessionId: sid });
  const toggleCompletion = useMutation(api.protocols.toggleCompletion);

  // AI parser action
  let parseQuickLog: any = null;
  try {
    parseQuickLog = useAction((api as any).quickLogAI.parseQuickLogInput);
  } catch {
    // Action not deployed yet — will use local-only parsing
  }

  // Filter items based on query (navigate mode)
  const filtered = useMemo(() => {
    if (!query.trim()) return COMMAND_ITEMS;
    const q = query.toLowerCase().trim();
    return COMMAND_ITEMS.filter((item) =>
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q))
    );
  }, [query]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filtered) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [filtered]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    const result: CommandItem[] = [];
    for (const cat of ['actions', 'core', 'health', 'insights', 'social']) {
      if (grouped[cat]) result.push(...grouped[cat]);
    }
    return result;
  }, [grouped]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setMode('navigate');
      setQuickLogResult(null);
      setIsProcessing(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Auto-detect quick-log intent from typing
  useEffect(() => {
    if (mode === 'navigate' && query.length >= 3 && looksLikeQuickLog(query)) {
      setMode('quicklog');
    }
  }, [query, mode]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current || mode !== 'navigate') return;
    const items = listRef.current.querySelectorAll('[data-command-item]');
    const selected = items[selectedIndex];
    if (selected) {
      selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, mode]);

  // Auto-dismiss success result + dispatch SomaticMirror pulse
  useEffect(() => {
    if (quickLogResult?.type === 'success') {
      // Dispatch SomaticMirror body-region pulse
      if (quickLogResult.bodyRegion && onSomaticPulse) {
        onSomaticPulse(quickLogResult.bodyRegion, quickLogResult.label);
      }
      // Also dispatch a custom event for any SomaticMirror instance listening
      window.dispatchEvent(new CustomEvent('vive:somatic-pulse', {
        detail: {
          region: quickLogResult.bodyRegion || 'neural',
          label: quickLogResult.label,
          icon: quickLogResult.icon,
          timestamp: Date.now(),
        },
      }));

      // Track recent log for session memory
      setRecentLogs(prev => [
        { icon: quickLogResult.icon, label: quickLogResult.label, time: Date.now() },
        ...prev.slice(0, 4),
      ]);

      const timer = setTimeout(() => {
        onClose();
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [quickLogResult, onClose, onSomaticPulse]);

  const handleSelect = useCallback((item: CommandItem) => {
    if (item.isAction && item.id === '__morningbrief') {
      onClose();
      window.dispatchEvent(new CustomEvent('vive-open-morning-brief'));
      return;
    }
    if (item.isAction && item.id === '__visitpacket') {
      onClose();
      window.dispatchEvent(new CustomEvent('vive-open-visit-packet'));
      return;
    }
    if (item.isAction && item.id === '__quicklog') {
      // Prefer the Manual Vitals drawer when available
      if (onOpenQuickLog) {
        onClose();
        onOpenQuickLog();
        return;
      }
      setMode('quicklog');
      setQuery('');
      setQuickLogResult(null);
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    if (item.isAction && item.id === '__connections') {
      onClose();
      if (typeof window !== 'undefined') {
        window.location.assign('/settings/connections');
      }
      return;
    }
    onNavigate(item.id as ViewId);
    onClose();
  }, [onNavigate, onClose, onOpenQuickLog]);

  /* ── Execute Quick-Log entry ── */
  const executeQuickLog = useCallback(async (input: string) => {
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    setQuickLogResult({ type: 'parsing', icon: '◎', label: 'Parsing...', detail: 'Analyzing your input' });

    try {
      let parsed: any;

      // Try enhanced local parsing first (handles dosages)
      const localResult = enhancedLocalParse(input);
      if (localResult && localResult.action !== 'unknown') {
        parsed = localResult;
      } else if (parseQuickLog) {
        const result = await parseQuickLog({ input, sessionId: sid });
        if (!result.success) {
          setQuickLogResult({ type: 'error', icon: '✕', label: 'Could not parse', detail: 'Try: "took 500mg magnesium", "slept 8h", "hrv 62"' });
          setIsProcessing(false);
          return;
        }
        parsed = result.parsed;
      } else {
        setQuickLogResult({ type: 'error', icon: '✕', label: 'Could not parse', detail: 'Try: "took 500mg magnesium", "slept 8h", "hrv 62"' });
        setIsProcessing(false);
        return;
      }

      // Execute the corresponding mutation
      switch (parsed.action) {
        case 'vital': {
          await logVital({
            sessionId: sid,
            vitalType: parsed.vitalType,
            value: parsed.value,
            unit: parsed.unit,
          });
          const vitalLabels: Record<string, string> = {
            hrv: 'HRV', hr: 'Heart Rate', spo2: 'SpO2',
            sleep_hours: 'Sleep', body_temp: 'Body Temp',
          };
          const vitalIcons: Record<string, string> = {
            hrv: '♡', hr: '❤️', spo2: '🫁', sleep_hours: '😴', body_temp: '🌡️',
          };
          const bodyRegion = CATEGORY_TO_BODY_REGION[`vital_${parsed.vitalType === 'sleep_hours' ? 'sleep' : parsed.vitalType === 'body_temp' ? 'temp' : parsed.vitalType}`] || 'neural';
          setQuickLogResult({
            type: 'success',
            icon: vitalIcons[parsed.vitalType] || '✓',
            label: `${vitalLabels[parsed.vitalType] || parsed.vitalType} logged`,
            detail: `${parsed.value} ${parsed.unit}`,
            bodyRegion,
          });
          break;
        }

        case 'mood_energy': {
          await logMoodEnergy({
            sessionId: sid,
            mood: Math.min(5, Math.max(1, parsed.mood)),
            energy: Math.min(5, Math.max(1, parsed.energy)),
          });
          setQuickLogResult({
            type: 'success',
            icon: parsed.mood >= 4 ? '🔥' : parsed.mood >= 3 ? '◎' : '💤',
            label: 'Mood & Energy logged',
            detail: `Mood ${parsed.mood}/5 · Energy ${parsed.energy}/5`,
            bodyRegion: 'neural',
          });
          break;
        }

        case 'protocol': {
          // Find matching protocol from today's status
          const matchedProtocol = protocolStatus?.items?.find((p: any) => {
            const pName = p.name.toLowerCase();
            const parsedName = (parsed.protocolName || '').toLowerCase();
            return pName === parsedName ||
              pName.includes(parsedName) ||
              parsedName.includes(pName) ||
              fuzzyMatch(pName, parsedName);
          });

          const bodyRegion = CATEGORY_TO_BODY_REGION[parsed.category] || 'metabolic';
          const dosageStr = parsed.dosage ? ` (${parsed.dosage})` : '';

          if (matchedProtocol && !matchedProtocol.completed) {
            await toggleCompletion({
              sessionId: sid,
              protocolId: matchedProtocol._id,
            });
            setQuickLogResult({
              type: 'success',
              icon: matchedProtocol.icon || '✦',
              label: `${matchedProtocol.name} completed`,
              detail: `Protocol verified${dosageStr} ✓`,
              bodyRegion,
              dosage: parsed.dosage,
            });
          } else if (matchedProtocol?.completed) {
            setQuickLogResult({
              type: 'success',
              icon: '✓',
              label: `${matchedProtocol.name}`,
              detail: `Already completed today${dosageStr}`,
              bodyRegion,
            });
          } else {
            setQuickLogResult({
              type: 'success',
              icon: '✦',
              label: `${parsed.protocolName} noted`,
              detail: `Logged as ${parsed.category}${dosageStr}`,
              bodyRegion,
              dosage: parsed.dosage,
            });
          }
          break;
        }

        default:
          setQuickLogResult({ type: 'error', icon: '✕', label: 'Could not parse', detail: 'Try: "took 500mg magnesium", "slept 8h", "hrv 62"' });
      }
    } catch (err: any) {
      setQuickLogResult({
        type: 'error',
        icon: '✕',
        label: 'Error',
        detail: err.message || 'Failed to log entry',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, parseQuickLog, sid, logVital, logMoodEnergy, protocolStatus, toggleCompletion]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (mode === 'quicklog' && !isProcessing) {
        setMode('navigate');
        setQuery('');
        setQuickLogResult(null);
      } else {
        onClose();
      }
      return;
    }

    if (mode === 'quicklog') {
      if (e.key === 'Enter' && query.trim() && !isProcessing) {
        e.preventDefault();
        executeQuickLog(query);
      }
      return;
    }

    // Navigate mode
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatList[selectedIndex]) {
          handleSelect(flatList[selectedIndex]);
        }
        break;
    }
  }, [mode, query, isProcessing, flatList, selectedIndex, handleSelect, onClose, executeQuickLog]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  // Pending protocols count
  const pendingCount = protocolStatus?.items?.filter((p: any) => !p.completed).length ?? 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[300] flex items-start justify-center pt-[15vh]"
          style={{ background: 'rgba(5,5,3,0.6)', backdropFilter: 'blur(8px)' }}
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-[520px] mx-4 rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(26, 24, 22, 0.95)',
              backdropFilter: 'blur(40px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
              border: `1px solid ${mode === 'quicklog' ? 'rgba(124,182,142,0.2)' : 'rgba(232,151,108,0.12)'}`,
              boxShadow: `0 24px 80px rgba(0,0,0,0.5), 0 0 40px ${mode === 'quicklog' ? 'rgba(124,182,142,0.06)' : 'rgba(232,151,108,0.04)'}, inset 0 1px 0 rgba(255,255,255,0.03)`,
              transition: 'border-color 0.3s, box-shadow 0.3s',
            }}
          >
            {/* ── Mode Toggle Tabs ── */}
            <div className="flex items-center gap-1 px-4 pt-3 pb-1">
              <button
                type="button"
                onClick={() => { setMode('navigate'); setQuery(''); setQuickLogResult(null); }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-[0.08em] transition-all duration-200"
                style={{
                  background: mode === 'navigate' ? 'rgba(232,151,108,0.12)' : 'transparent',
                  color: mode === 'navigate' ? '#E8976C' : 'rgba(138,126,114,0.5)',
                  border: `1px solid ${mode === 'navigate' ? 'rgba(232,151,108,0.2)' : 'transparent'}`,
                }}
              >
                ⬡ Navigate
              </button>
              <button
                type="button"
                onClick={() => { setMode('quicklog'); setQuery(''); setQuickLogResult(null); setTimeout(() => inputRef.current?.focus(), 50); }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-[0.08em] transition-all duration-200"
                style={{
                  background: mode === 'quicklog' ? 'rgba(124,182,142,0.12)' : 'transparent',
                  color: mode === 'quicklog' ? '#7CB68E' : 'rgba(138,126,114,0.5)',
                  border: `1px solid ${mode === 'quicklog' ? 'rgba(124,182,142,0.2)' : 'transparent'}`,
                }}
              >
                ⚡ Quick-Log
              </button>
              {/* Live pending count badge */}
              {pendingCount > 0 && mode === 'quicklog' && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="ml-auto px-2 py-0.5 rounded-full text-[9px] font-bold"
                  style={{ background: 'rgba(232,151,108,0.15)', color: '#E8976C', border: '1px solid rgba(232,151,108,0.2)' }}
                >
                  {pendingCount} pending
                </motion.span>
              )}
            </div>

            {/* ── Search / Quick-Log Input ── */}
            <div className="relative flex items-center px-4 py-3.5 border-b" style={{ borderColor: 'rgba(42,38,34,0.8)' }}>
              {mode === 'navigate' ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mr-3 flex-shrink-0" style={{ opacity: 0.4 }}>
                  <circle cx="7" cy="7" r="5" stroke="#E8976C" strokeWidth="1.5" />
                  <path d="M11 11L14 14" stroke="#E8976C" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              ) : (
                <motion.span
                  className="mr-3 text-[14px] flex-shrink-0"
                  animate={isProcessing ? { rotate: 360 } : { rotate: 0 }}
                  transition={isProcessing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
                  style={{ opacity: isProcessing ? 0.3 : 0.7 }}
                >
                  {isProcessing ? '◎' : '⚡'}
                </motion.span>
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); if (quickLogResult?.type !== 'parsing') setQuickLogResult(null); }}
                onKeyDown={handleKeyDown}
                placeholder={mode === 'navigate' ? 'Navigate or type a health log...' : 'took 500mg magnesium, slept 8 hours, hrv 62...'}
                disabled={isProcessing}
                className="flex-1 bg-transparent border-none outline-none text-sm disabled:opacity-40"
                style={{
                  color: '#E8E0D8',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  letterSpacing: '-0.01em',
                }}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="flex items-center gap-1 ml-2">
                {mode === 'quicklog' && query.trim() && !isProcessing && (
                  <motion.kbd
                    initial={{ opacity: 0, x: 4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="px-1.5 py-0.5 rounded text-[9px] font-mono"
                    style={{
                      background: 'rgba(124,182,142,0.12)',
                      border: '1px solid rgba(124,182,142,0.2)',
                      color: 'rgba(124,182,142,0.7)',
                    }}
                  >
                    ↵ Log
                  </motion.kbd>
                )}
                <kbd className="px-1.5 py-0.5 rounded text-[9px] font-mono" style={{
                  background: 'rgba(42,38,34,0.6)',
                  border: '1px solid rgba(42,38,34,0.8)',
                  color: 'rgba(138,126,114,0.7)',
                }}>
                  ESC
                </kbd>
              </div>
            </div>

            {/* ── Quick-Log Mode Content ── */}
            {mode === 'quicklog' && (
              <div className="py-3">
                <AnimatePresence mode="wait">
                  {/* Result feedback with body-region indicator */}
                  {quickLogResult && (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                      className="px-4 py-4"
                    >
                      <div
                        className="flex items-center gap-3 p-4 rounded-xl relative overflow-hidden"
                        style={{
                          background: quickLogResult.type === 'success'
                            ? 'rgba(124,182,142,0.08)'
                            : quickLogResult.type === 'error'
                              ? 'rgba(220,100,80,0.08)'
                              : 'rgba(232,151,108,0.06)',
                          border: `1px solid ${
                            quickLogResult.type === 'success'
                              ? 'rgba(124,182,142,0.15)'
                              : quickLogResult.type === 'error'
                                ? 'rgba(220,100,80,0.15)'
                                : 'rgba(232,151,108,0.1)'
                          }`,
                        }}
                      >
                        {/* Success ripple animation */}
                        {quickLogResult.type === 'success' && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0.4 }}
                            animate={{ scale: 4, opacity: 0 }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="absolute inset-0 rounded-full pointer-events-none"
                            style={{
                              background: 'radial-gradient(circle, rgba(124,182,142,0.2) 0%, transparent 70%)',
                              transformOrigin: '20% 50%',
                            }}
                          />
                        )}

                        {/* Animated icon */}
                        <motion.div
                          initial={{ scale: 0.5, rotate: -10 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 relative z-10"
                          style={{
                            background: quickLogResult.type === 'success'
                              ? 'rgba(124,182,142,0.15)'
                              : quickLogResult.type === 'error'
                                ? 'rgba(220,100,80,0.12)'
                                : 'rgba(232,151,108,0.1)',
                          }}
                        >
                          {quickLogResult.type === 'parsing' ? (
                            <motion.span
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            >
                              ◎
                            </motion.span>
                          ) : (
                            quickLogResult.icon
                          )}
                        </motion.div>

                        <div className="flex-1 min-w-0 relative z-10">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-semibold" style={{
                              color: quickLogResult.type === 'success' ? '#7CB68E' : quickLogResult.type === 'error' ? '#DC6450' : '#E8976C',
                            }}>
                              {quickLogResult.label}
                            </span>
                            {/* Body region badge */}
                            {quickLogResult.bodyRegion && quickLogResult.type === 'success' && (
                              <motion.span
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.15 }}
                                className="px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider"
                                style={{
                                  background: 'rgba(124,182,142,0.1)',
                                  color: 'rgba(124,182,142,0.6)',
                                  border: '1px solid rgba(124,182,142,0.12)',
                                }}
                              >
                                {BODY_REGION_LABELS[quickLogResult.bodyRegion] || quickLogResult.bodyRegion}
                              </motion.span>
                            )}
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: 'rgba(138,126,114,0.7)' }}>
                            {quickLogResult.detail}
                          </div>
                        </div>

                        {quickLogResult.type === 'success' && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 500 }}
                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 relative z-10"
                            style={{ background: 'rgba(124,182,142,0.2)' }}
                          >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#7CB68E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </motion.div>
                        )}
                      </div>

                      {/* SomaticMirror sync indicator */}
                      {quickLogResult.type === 'success' && quickLogResult.bodyRegion && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          transition={{ delay: 0.3, duration: 0.2 }}
                          className="flex items-center gap-2 mt-2 px-1"
                        >
                          <motion.div
                            animate={{ opacity: [0.3, 0.8, 0.3] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: '#7CB68E' }}
                          />
                          <span className="text-[9px]" style={{ color: 'rgba(124,182,142,0.5)' }}>
                            Digital Twin updated · {BODY_REGION_LABELS[quickLogResult.bodyRegion]} region synced
                          </span>
                        </motion.div>
                      )}
                    </motion.div>
                  )}

                  {/* Hint suggestions (when no result showing) */}
                  {!quickLogResult && (
                    <motion.div
                      key="hints"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="px-4"
                    >
                      {/* Recent logs memory */}
                      {recentLogs.length > 0 && (
                        <div className="mb-3">
                          <span className="text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'rgba(124,182,142,0.35)' }}>
                            Recent
                          </span>
                          <div className="flex items-center gap-2 mt-1.5 overflow-x-auto">
                            {recentLogs.map((log, i) => (
                              <span
                                key={`${log.time}-${i}`}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] whitespace-nowrap flex-shrink-0"
                                style={{ background: 'rgba(124,182,142,0.06)', border: '1px solid rgba(124,182,142,0.08)', color: 'rgba(232,224,216,0.5)' }}
                              >
                                <span>{log.icon}</span>
                                {log.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mb-2">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'rgba(124,182,142,0.45)' }}>
                          Try saying
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {QUICK_LOG_HINTS.map((hint) => (
                          <button
                            key={hint.text}
                            type="button"
                            onClick={() => {
                              setQuery(hint.text);
                              inputRef.current?.focus();
                            }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-150 hover:scale-[1.02]"
                            style={{
                              background: 'rgba(42,38,34,0.3)',
                              border: '1px solid rgba(42,38,34,0.5)',
                            }}
                          >
                            <span className="text-[12px]">{hint.icon}</span>
                            <span className="text-[11px] truncate" style={{ color: 'rgba(232,224,216,0.6)' }}>
                              {hint.text}
                            </span>
                          </button>
                        ))}
                      </div>

                      {/* Today's incomplete protocols as quick-complete buttons */}
                      {protocolStatus && pendingCount > 0 && (
                        <div className="mt-3">
                          <div className="mb-1.5">
                            <span className="text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'rgba(232,151,108,0.4)' }}>
                              Pending Protocols ({pendingCount})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {protocolStatus.items
                              .filter((p: any) => !p.completed)
                              .slice(0, 6)
                              .map((p: any) => (
                                <button
                                  key={p._id}
                                  type="button"
                                  onClick={async () => {
                                    setIsProcessing(true);
                                    setQuickLogResult({ type: 'parsing', icon: '◎', label: 'Completing...', detail: p.name });
                                    try {
                                      await toggleCompletion({ sessionId: sid, protocolId: p._id });
                                      const bodyRegion = CATEGORY_TO_BODY_REGION[p.category?.toLowerCase()] || 'metabolic';
                                      setQuickLogResult({
                                        type: 'success',
                                        icon: p.icon || '✦',
                                        label: `${p.name} completed`,
                                        detail: 'Protocol verified ✓',
                                        bodyRegion,
                                      });
                                    } catch {
                                      setQuickLogResult({ type: 'error', icon: '✕', label: 'Failed', detail: 'Could not complete protocol' });
                                    } finally {
                                      setIsProcessing(false);
                                    }
                                  }}
                                  disabled={isProcessing}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-150 hover:scale-[1.02] disabled:opacity-40"
                                  style={{
                                    background: 'rgba(232,151,108,0.06)',
                                    border: '1px solid rgba(232,151,108,0.12)',
                                  }}
                                >
                                  <span className="text-[11px]">{p.icon}</span>
                                  <span className="text-[10px] font-medium" style={{ color: 'rgba(232,224,216,0.6)' }}>
                                    {p.name}
                                  </span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* ── Navigate Mode Results ── */}
            {mode === 'navigate' && (
              <div
                ref={listRef}
                className="max-h-[360px] overflow-y-auto py-2 command-bar-scroll"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(232,151,108,0.1) transparent' }}
              >
                {flatList.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <span className="text-[12px]" style={{ color: '#8A7E72' }}>
                      No results for &ldquo;{query}&rdquo;
                    </span>
                  </div>
                ) : (
                  Object.entries(grouped).map(([category, items]) => (
                    <div key={category}>
                      <div className="px-4 pt-2.5 pb-1">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: 'rgba(232,151,108,0.45)' }}>
                          {CATEGORY_LABELS[category] || category}
                        </span>
                      </div>
                      {items.map((item) => {
                        const flatIndex = flatList.indexOf(item);
                        const isSelected = flatIndex === selectedIndex;
                        const isActive = item.id === activeView;

                        return (
                          <button
                            key={item.id}
                            data-command-item
                            type="button"
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(flatIndex)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100"
                            style={{
                              background: isSelected ? 'rgba(232,151,108,0.08)' : 'transparent',
                              borderLeft: isSelected ? '2px solid rgba(232,151,108,0.4)' : '2px solid transparent',
                            }}
                          >
                            <span
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-[13px] flex-shrink-0 transition-all duration-200"
                              style={{
                                background: isSelected ? 'rgba(232,151,108,0.12)' : 'rgba(42,38,34,0.5)',
                                border: `1px solid ${isSelected ? 'rgba(232,151,108,0.2)' : 'rgba(42,38,34,0.6)'}`,
                                boxShadow: isSelected ? '0 0 12px rgba(232,151,108,0.06)' : 'none',
                              }}
                            >
                              {item.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-[13px] font-semibold truncate"
                                  style={{
                                    color: isSelected ? '#E8E0D8' : 'rgba(232,224,216,0.7)',
                                    letterSpacing: '-0.01em',
                                  }}
                                >
                                  {item.label}
                                </span>
                                {isActive && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider"
                                    style={{
                                      background: 'rgba(124,182,142,0.12)',
                                      color: 'rgba(124,182,142,0.8)',
                                      border: '1px solid rgba(124,182,142,0.15)',
                                    }}
                                  >
                                    Active
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-[11px] truncate block"
                                style={{ color: 'rgba(138,126,114,0.7)' }}
                              >
                                {item.description}
                              </span>
                            </div>
                            {isSelected && (
                              <motion.span
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 0.5, x: 0 }}
                                className="text-[10px] flex-shrink-0"
                                style={{ color: '#E8976C' }}
                              >
                                ↵
                              </motion.span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── Footer ── */}
            <div
              className="flex items-center justify-between px-4 py-2.5 border-t"
              style={{ borderColor: 'rgba(42,38,34,0.6)', background: 'rgba(15,14,13,0.4)' }}
            >
              <div className="flex items-center gap-3">
                {mode === 'navigate' ? (
                  <>
                    <div className="flex items-center gap-1">
                      <kbd className="px-1 py-0.5 rounded text-[8px] font-mono" style={{
                        background: 'rgba(42,38,34,0.5)',
                        border: '1px solid rgba(42,38,34,0.6)',
                        color: 'rgba(138,126,114,0.6)',
                      }}>↑↓</kbd>
                      <span className="text-[9px]" style={{ color: 'rgba(138,126,114,0.4)' }}>navigate</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <kbd className="px-1 py-0.5 rounded text-[8px] font-mono" style={{
                        background: 'rgba(42,38,34,0.5)',
                        border: '1px solid rgba(42,38,34,0.6)',
                        color: 'rgba(138,126,114,0.6)',
                      }}>↵</kbd>
                      <span className="text-[9px]" style={{ color: 'rgba(138,126,114,0.4)' }}>select</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded text-[8px] font-mono" style={{
                      background: 'rgba(42,38,34,0.5)',
                      border: '1px solid rgba(42,38,34,0.6)',
                      color: 'rgba(138,126,114,0.6)',
                    }}>↵</kbd>
                    <span className="text-[9px]" style={{ color: 'rgba(138,126,114,0.4)' }}>parse & log</span>
                  </div>
                )}
              </div>
              <span className="text-[9px] font-mono" style={{ color: mode === 'quicklog' ? 'rgba(124,182,142,0.3)' : 'rgba(232,151,108,0.3)' }}>
                {mode === 'quicklog' ? 'QUICK-LOG' : 'VIVE CMD'}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Body region display labels ── */
const BODY_REGION_LABELS: Record<string, string> = {
  neural: 'Neural',
  nervous: 'Nervous System',
  metabolic: 'Metabolic Core',
  digestive: 'Digestive',
  musculature: 'Musculature',
};

/* ── Fuzzy string match helper ── */
function fuzzyMatch(a: string, b: string): boolean {
  const aWords = a.split(/\s+/);
  const bWords = b.split(/\s+/);
  return aWords.some((aw) => bWords.some((bw) => aw.includes(bw) || bw.includes(aw)));
}

/* ═══════════════════════════════════════════════════════════════
   ENHANCED LOCAL PARSER — Dosage-Aware Natural Language Parsing
   
   Handles inputs like:
   - "took 500mg magnesium"
   - "5000 IU vitamin d"
   - "slept 8 hours"
   - "hrv 62"
   - "cold plunge done"
   - "feeling great"
   - "ran 3 miles"
   ═══════════════════════════════════════════════════════════════ */
function enhancedLocalParse(input: string): any {
  const lower = input.toLowerCase().trim();

  // ── HRV: "hrv 62", "hrv: 65ms" ──
  const hrvMatch = lower.match(/^hrv[\s:]*(\d+(?:\.\d+)?)\s*(?:ms)?$/);
  if (hrvMatch) return { action: 'vital', vitalType: 'hrv', value: parseFloat(hrvMatch[1]), unit: 'ms' };

  // ── HR: "hr 68", "heart rate 72", "rhr 58" ──
  const hrMatch = lower.match(/^(?:hr|heart\s*rate|rhr|resting\s*hr)[\s:]*(\d+(?:\.\d+)?)\s*(?:bpm)?$/);
  if (hrMatch) return { action: 'vital', vitalType: 'hr', value: parseFloat(hrMatch[1]), unit: 'bpm' };

  // ── SpO2: "spo2 98", "oxygen 97" ──
  const spo2Match = lower.match(/^(?:spo2|sp02|oxygen|o2)[\s:]*(\d+(?:\.\d+)?)\s*%?$/);
  if (spo2Match) return { action: 'vital', vitalType: 'spo2', value: parseFloat(spo2Match[1]), unit: '%' };

  // ── Sleep: "slept 8 hours", "sleep 7.5h", "8 hours sleep" ──
  const sleepMatch = lower.match(/(?:slept|sleep)\s*(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)?/) ||
    lower.match(/^(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:of\s*)?sleep$/);
  if (sleepMatch) return { action: 'vital', vitalType: 'sleep_hours', value: parseFloat(sleepMatch[1]), unit: 'hours' };

  // ── Body temp: "temp 98.6", "body temp 99.1" ──
  const tempMatch = lower.match(/^(?:body\s*)?temp(?:erature)?[\s:]*(\d+(?:\.\d+)?)\s*(?:°?f)?$/);
  if (tempMatch) return { action: 'vital', vitalType: 'body_temp', value: parseFloat(tempMatch[1]), unit: '°F' };

  // ── Mood/Energy explicit: "mood 4 energy 3" ──
  const moodEnergyMatch = lower.match(/mood[\s:]*(\d)\s*(?:energy|e)[\s:]*(\d)/);
  if (moodEnergyMatch) return { action: 'mood_energy', mood: parseInt(moodEnergyMatch[1]), energy: parseInt(moodEnergyMatch[2]) };

  const moodOnly = lower.match(/^mood[\s:]*(\d)$/);
  if (moodOnly) return { action: 'mood_energy', mood: parseInt(moodOnly[1]), energy: parseInt(moodOnly[1]) };

  const energyOnly = lower.match(/^energy[\s:]*(\d)$/);
  if (energyOnly) return { action: 'mood_energy', mood: parseInt(energyOnly[1]), energy: parseInt(energyOnly[1]) };

  // ── Dosage-aware supplement parsing ──
  // Patterns: "took 500mg magnesium", "had 5000 IU vitamin d", "took magnesium 400mg"
  const dosageMatch = lower.match(/(?:took|had|take)\s+(?:(\d+(?:\.\d+)?)\s*(?:mg|iu|mcg|g|ml)\s+)?(.+?)(?:\s+(\d+(?:\.\d+)?)\s*(?:mg|iu|mcg|g|ml))?$/);
  if (dosageMatch) {
    const dosageAmount = dosageMatch[1] || dosageMatch[3] || null;
    const dosageUnit = lower.match(/(\d+(?:\.\d+)?)\s*(mg|iu|mcg|g|ml)/)?.[2] || '';
    const substanceName = (dosageMatch[2] || '').trim();
    const dosageStr = dosageAmount ? `${dosageAmount}${dosageUnit}` : undefined;

    const supplementMap: Record<string, string> = {
      'vitamin d': 'Vitamin D3 + K2', 'vit d': 'Vitamin D3 + K2', 'd3': 'Vitamin D3 + K2', 'vitamin d3': 'Vitamin D3 + K2',
      'fish oil': 'Omega-3 Fish Oil', 'omega': 'Omega-3 Fish Oil', 'omega 3': 'Omega-3 Fish Oil', 'omega-3': 'Omega-3 Fish Oil',
      'creatine': 'Creatine Monohydrate',
      'magnesium': 'Magnesium Glycinate', 'mag': 'Magnesium Glycinate', 'mag glycinate': 'Magnesium Glycinate',
      'zinc': 'Zinc Picolinate',
      'iron': 'Iron Bisglycinate',
      'ashwagandha': 'Ashwagandha KSM-66',
      'k2': 'Vitamin K2 MK-7',
      'b12': 'Vitamin B12',
      'b complex': 'B-Complex',
      'probiotics': 'Probiotics',
      'collagen': 'Collagen Peptides',
      'turmeric': 'Turmeric Curcumin',
      'melatonin': 'Melatonin',
      'l-theanine': 'L-Theanine',
      'theanine': 'L-Theanine',
    };

    for (const [key, name] of Object.entries(supplementMap)) {
      if (substanceName.includes(key)) {
        return { action: 'protocol', protocolName: name, category: 'supplement', dosage: dosageStr };
      }
    }

    // Generic supplement if "took" was used but no match
    if (substanceName.length > 1) {
      const capitalizedName = substanceName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return { action: 'protocol', protocolName: capitalizedName, category: 'supplement', dosage: dosageStr };
    }
  }

  // ── Direct supplement matches (without "took") ──
  const supplementDirect: Record<string, string> = {
    'vitamin d': 'Vitamin D3 + K2', 'vit d': 'Vitamin D3 + K2', 'd3': 'Vitamin D3 + K2',
    'fish oil': 'Omega-3 Fish Oil', 'omega': 'Omega-3 Fish Oil',
    'creatine': 'Creatine Monohydrate',
    'magnesium': 'Magnesium Glycinate', 'mag': 'Magnesium Glycinate',
  };
  for (const [key, name] of Object.entries(supplementDirect)) {
    if (lower.includes(key) && (lower.startsWith('took') || lower.startsWith('had'))) {
      return { action: 'protocol', protocolName: name, category: 'supplement' };
    }
  }

  // ── Direct protocol matches ──
  const protocolMap: Record<string, { name: string; category: string }> = {
    'cold plunge': { name: 'Cold Plunge', category: 'biohacking' },
    'cold shower': { name: 'Cold Plunge', category: 'biohacking' },
    'ice bath': { name: 'Cold Plunge', category: 'biohacking' },
    'sauna': { name: 'Infrared Sauna', category: 'biohacking' },
    'sunlight': { name: 'Morning Sunlight', category: 'biohacking' },
    'morning sun': { name: 'Morning Sunlight', category: 'biohacking' },
    'zone 2': { name: 'Zone 2 Cardio', category: 'training' },
    'cardio': { name: 'Zone 2 Cardio', category: 'training' },
    'weights': { name: 'Resistance Training', category: 'training' },
    'lifted': { name: 'Resistance Training', category: 'training' },
    'resistance': { name: 'Resistance Training', category: 'training' },
    'ran': { name: 'Zone 2 Cardio', category: 'training' },
    'run': { name: 'Zone 2 Cardio', category: 'training' },
    'jog': { name: 'Zone 2 Cardio', category: 'training' },
    'walk': { name: 'Walking', category: 'movement' },
    'walked': { name: 'Walking', category: 'movement' },
    'yoga': { name: 'Yoga Flow', category: 'recovery' },
    'stretch': { name: 'Stretching', category: 'recovery' },
    'protein': { name: 'Protein Target', category: 'nutrition' },
    'hydration': { name: 'Hydration 3L+', category: 'nutrition' },
    'water': { name: 'Hydration 3L+', category: 'nutrition' },
    'breathwork': { name: 'Breathwork', category: 'biohacking' },
    'meditation': { name: '10-Min Meditation', category: 'recovery' },
    'meditated': { name: '10-Min Meditation', category: 'recovery' },
    'fasting': { name: 'Intermittent Fasting', category: 'nutrition' },
    'fasted': { name: 'Intermittent Fasting', category: 'nutrition' },
    'grounding': { name: 'Grounding', category: 'biohacking' },
    'red light': { name: 'Red Light Therapy', category: 'biohacking' },
  };

  for (const [key, val] of Object.entries(protocolMap)) {
    if (lower.includes(key)) {
      return { action: 'protocol', protocolName: val.name, category: val.category };
    }
  }

  // ── Sentiment-based mood/energy ──
  const positive = ['great', 'amazing', 'excellent', 'energized', 'strong', 'good', 'fantastic', 'rested', 'recovered'];
  const negative = ['tired', 'exhausted', 'bad', 'terrible', 'drained', 'sluggish', 'awful', 'sick', 'low'];
  const neutral = ['okay', 'ok', 'fine', 'normal', 'average', 'meh'];
  if (positive.some((w) => lower.includes(w))) return { action: 'mood_energy', mood: 4, energy: 4 };
  if (negative.some((w) => lower.includes(w))) return { action: 'mood_energy', mood: 2, energy: 2 };
  if (neutral.some((w) => lower.includes(w))) return { action: 'mood_energy', mood: 3, energy: 3 };

  return { action: 'unknown', raw: input };
}

/* ── Hook for global Cmd+K listener ── */
export function useCommandBar() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, open, close };
}

export default CommandBar;
