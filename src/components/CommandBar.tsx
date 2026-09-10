import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useArchitectChat, parseAIActions, type BioSnapshot, type AIAction } from '../lib/useAI';

/* ═══════════════════════════════════════════════════════════════
   GLOBAL COMMAND BAR — Primary Navigation for Longevity OS
   
   Cmd+K / ⌘K opens a unified command interface:
   • Natural language → AI Brain ("How did my last labs look?")
   • Somatic state detection → Proactive interventions
   • Quick-log execution ("Log 250mcg BPC-157")
   • Deep-link navigation ("Show my recovery protocol")
   • Voice command support
   • One-tap intervention execution → Protocol HUD update
   ═══════════════════════════════════════════════════════════════ */

const HUD = {
  bg: '#0A0908',
  surface: 'rgba(12, 11, 10, 0.98)',
  border: 'rgba(196, 164, 108, 0.12)',
  borderActive: 'rgba(196, 164, 108, 0.3)',
  gold: '#C4A46C',
  goldDim: 'rgba(196, 164, 108, 0.6)',
  goldGlow: 'rgba(196, 164, 108, 0.08)',
  text: '#E8E0D8',
  textDim: '#6A6259',
  textMuted: 'rgba(232, 224, 216, 0.4)',
  green: '#4ADE80',
  red: '#FF6B6B',
  cyan: '#67E8F9',
  violet: '#A78BFA',
  orange: '#E8976C',
};

/* ── Intent Classification ── */
type CommandIntent = 'query' | 'log' | 'navigate' | 'somatic' | 'unknown';

interface ClassifiedCommand {
  intent: CommandIntent;
  confidence: number;
  navigateTarget?: string;
  logType?: string;
  logDetail?: string;
}

/* ── Navigation targets ── */
const NAV_TARGETS: Array<{ id: string; label: string; icon: string; keywords: string[]; description: string }> = [
  { id: 'dashboard', label: 'Command Center', icon: '⬡', keywords: ['home', 'main', 'dashboard', 'overview'], description: 'Main dashboard' },
  { id: 'briefing', label: 'Briefing Room', icon: '◉', keywords: ['brief', 'ai', 'chat', 'coach', 'ask', 'advisor'], description: 'AI coaching chat' },
  { id: 'protocols', label: 'Protocol Stack', icon: '✦', keywords: ['protocol', 'stack', 'habits', 'routine', 'supplement', 'peptide'], description: 'Daily protocols' },
  { id: 'biovault', label: 'Bio-Vault', icon: '◈', keywords: ['vault', 'bio', 'labs', 'blood', 'biomarker', 'data'], description: 'Health data vault' },
  { id: 'journal', label: 'Journal', icon: '◎', keywords: ['journal', 'log', 'diary', 'entry'], description: 'Daily journal' },
  { id: 'vitals', label: 'Vitals', icon: '♡', keywords: ['vitals', 'hrv', 'heart', 'sleep', 'recovery'], description: 'Biometric vitals' },
  { id: 'nutrition', label: 'Nutrition', icon: '◐', keywords: ['nutrition', 'food', 'meal', 'macros', 'calories', 'diet'], description: 'Nutrition tracking' },
  { id: 'activity', label: 'Activity', icon: '△', keywords: ['activity', 'workout', 'exercise', 'training', 'movement'], description: 'Activity tracking' },
  { id: 'progress', label: 'Progress', icon: '▲', keywords: ['progress', 'weight', 'body', 'composition', 'goals'], description: 'Progress tracking' },
  { id: 'dna', label: 'DNA Insights', icon: '⧬', keywords: ['dna', 'genetic', 'genes', 'mthfr', 'apoe'], description: 'Genetic analysis' },
  { id: 'report', label: 'Weekly Report', icon: '◆', keywords: ['report', 'weekly', 'summary', 'review'], description: 'Weekly performance' },
  { id: 'community', label: 'Community', icon: '◬', keywords: ['community', 'squad', 'social', 'leaderboard'], description: 'Squad network' },
  { id: 'blueprint', label: 'Blueprint', icon: '⬢', keywords: ['blueprint', 'builder', 'plan', 'design'], description: 'Protocol builder' },
  { id: 'biomarkers', label: 'Biomarkers', icon: '◇', keywords: ['biomarkers', 'markers', 'readings', 'crp', 'testosterone', 'vitamin d'], description: 'Biomarker deep-dive' },
];

/* ── Somatic patterns (client-side pre-detection for intent badge) ── */
const SOMATIC_KEYWORDS = [
  /sluggish/i, /brain\s*fog/i, /foggy/i, /can'?t\s*focus/i, /groggy/i,
  /tired/i, /exhausted/i, /fatigued/i, /no\s*energy/i, /drained/i, /burnt?\s*out/i,
  /anxious/i, /stressed/i, /wired/i, /can'?t\s*relax/i, /overwhelmed/i,
  /sore/i, /aching/i, /stiff/i, /pain/i, /inflamed/i,
  /can'?t\s*sleep/i, /insomnia/i, /restless/i,
  /hungry/i, /craving/i, /headache/i, /migraine/i,
  /great/i, /amazing/i, /on\s*fire/i, /crushing\s*it/i, /peak/i,
  /feeling/i, /feel\s/i, /i\s*feel/i,
];

/* ── Quick-log patterns ── */
const LOG_PATTERNS = [
  { pattern: /^(?:log|took|had|did|finished|completed|ate|drank|taking)\s+/i, type: 'supplement' },
  { pattern: /^(?:slept|sleep)\s+/i, type: 'sleep' },
  { pattern: /^(?:hrv|heart\s*rate|hr|rhr|spo2)\s*[:=]?\s*\d/i, type: 'vital' },
  { pattern: /^\d+(?:\.\d+)?\s*(?:mg|iu|mcg|g|ml)\s+/i, type: 'supplement' },
  { pattern: /^(?:mood|energy|pain|stress|focus)\s*[:=]?\s*\d/i, type: 'somatic' },
  { pattern: /^(?:ran|walked|biked|swam|lifted|hiked)\s+/i, type: 'exercise' },
  { pattern: /^(?:cold|sauna|sunlight|meditation|breathwork|yoga)\s*/i, type: 'protocol' },
  { pattern: /^(?:weight|weigh)\s*[:=]?\s*\d/i, type: 'vital' },
];

/* ── Query patterns ── */
const QUERY_PATTERNS = [
  /^(?:how|what|why|when|should|is|do|can|tell|show|explain|analyze|check|review)\s/i,
  /\?$/,
  /^(?:my|the)\s+(?:last|latest|recent|current|today)/i,
  /(?:look|doing|going|trending|status|score|level)/i,
];

function classifyCommand(input: string): ClassifiedCommand {
  const trimmed = input.trim();
  if (!trimmed) return { intent: 'unknown', confidence: 0 };
  const lower = trimmed.toLowerCase();

  // Check navigation
  for (const nav of NAV_TARGETS) {
    const allKeywords = [nav.label.toLowerCase(), ...nav.keywords];
    for (const kw of allKeywords) {
      if (lower === kw || lower === `go to ${kw}` || lower === `open ${kw}` || lower === `show ${kw}` || lower === `navigate to ${kw}`) {
        return { intent: 'navigate', confidence: 0.95, navigateTarget: nav.id };
      }
    }
  }

  // Check somatic state (before log/query — "I feel sluggish" is somatic, not a query)
  for (const sk of SOMATIC_KEYWORDS) {
    if (sk.test(trimmed)) {
      return { intent: 'somatic', confidence: 0.9 };
    }
  }

  // Check quick-log
  for (const lp of LOG_PATTERNS) {
    if (lp.pattern.test(trimmed)) {
      return { intent: 'log', confidence: 0.9, logType: lp.type, logDetail: trimmed };
    }
  }

  // Check query
  for (const qp of QUERY_PATTERNS) {
    if (qp.test(trimmed)) return { intent: 'query', confidence: 0.85 };
  }

  // Fuzzy nav
  for (const nav of NAV_TARGETS) {
    const allKeywords = [nav.label.toLowerCase(), ...nav.keywords];
    if (allKeywords.some(kw => lower.includes(kw) || kw.includes(lower))) {
      return { intent: 'navigate', confidence: 0.7, navigateTarget: nav.id };
    }
  }

  if (trimmed.length > 8) return { intent: 'query', confidence: 0.6 };
  return { intent: 'unknown', confidence: 0.3 };
}

/* ── Intervention type ── */
interface Intervention {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  dosage?: string;
  duration?: string;
  mechanism: string;
  timeToEffect: string;
  priority: number;
  executable?: boolean;
}

/* ── Suggestion items ── */
const SUGGESTIONS = [
  { icon: '🧠', text: 'I feel brain fog', intent: 'somatic' as const },
  { icon: '🧬', text: 'How did my last labs look?', intent: 'query' as const },
  { icon: '💊', text: 'Log 250mcg BPC-157', intent: 'log' as const },
  { icon: '📋', text: "What's my recovery protocol today?", intent: 'query' as const },
  { icon: '😴', text: 'Slept 7.5 hours', intent: 'log' as const },
  { icon: '⚡', text: 'I feel exhausted', intent: 'somatic' as const },
  { icon: '🩸', text: 'Show my biomarkers', intent: 'navigate' as const },
  { icon: '😰', text: "I'm stressed and can't relax", intent: 'somatic' as const },
];

/* ═══════════════════════════════════════════════════════════════ */

interface CommandBarProps {
  onNavigate?: (viewId: string) => void;
  sessionId?: string;
  bioSnapshot?: BioSnapshot;
}

export default function CommandBar({ onNavigate, sessionId, bioSnapshot }: CommandBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'classifying' | 'processing' | 'result' | 'error'>('idle');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());
  const [logResult, setLogResult] = useState<{ success: boolean; message: string; icon: string } | null>(null);
  const [classification, setClassification] = useState<ClassifiedCommand | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [responseType, setResponseType] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const sid = sessionId || 'default-session';

  const { sendMessage } = useArchitectChat();
  const snapshot = bioSnapshot || {};

  // Convex hooks
  const logVital = useMutation(api.quickLog.logVital);
  const logMoodEnergy = useMutation(api.quickLog.logMoodEnergy);

  let processCommandAction: any = null;
  try { processCommandAction = useAction((api as any).commandProcessor?.processCommand); } catch { /* not deployed */ }

  let executeInterventionMut: any = null;
  try { executeInterventionMut = useMutation((api as any).commandProcessor?.executeIntervention); } catch { /* not deployed */ }

  let parseQuickLog: any = null;
  try { parseQuickLog = useAction((api as any).quickLogAI?.parseQuickLogInput); } catch { /* not deployed */ }

  // ── Keyboard shortcut: Cmd+K / Ctrl+K ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setPhase('idle');
      setAiResponse(null);
      setInterventions([]);
      setLogResult(null);
      setClassification(null);
      setSelectedIdx(0);
      setExecutingIds(new Set());
      setExecutedIds(new Set());
      setResponseType('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Live classification
  useEffect(() => {
    if (query.trim().length > 1) {
      setClassification(classifyCommand(query));
    } else {
      setClassification(null);
    }
  }, [query]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setPhase('idle');
    setAiResponse(null);
    setInterventions([]);
    setLogResult(null);
  }, []);

  // ── Filter nav targets ──
  const filteredNav = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return NAV_TARGETS.filter(n => {
      const all = [n.label.toLowerCase(), ...n.keywords, n.description.toLowerCase()];
      return all.some(k => k.includes(q) || q.includes(k));
    }).slice(0, 5);
  }, [query]);

  // ── Execute intervention → insert into Protocol HUD ──
  const handleExecuteIntervention = useCallback(async (intervention: Intervention) => {
    if (executingIds.has(intervention.id) || executedIds.has(intervention.id)) return;
    setExecutingIds(prev => new Set(prev).add(intervention.id));

    try {
      if (executeInterventionMut) {
        await executeInterventionMut({
          sessionId: sid,
          interventionId: intervention.id,
          name: intervention.name,
          icon: intervention.icon,
          category: intervention.category,
          description: intervention.description,
          dosage: intervention.dosage || undefined,
          duration: intervention.duration || undefined,
        });
      }
      setExecutedIds(prev => new Set(prev).add(intervention.id));
      // Dispatch event so ProtocolMasterHUD refreshes
      window.dispatchEvent(new CustomEvent('vive-protocol-updated', {
        detail: { interventionId: intervention.id, name: intervention.name, category: intervention.category }
      }));
    } catch (err) {
      console.error('Failed to execute intervention:', err);
    } finally {
      setExecutingIds(prev => { const n = new Set(prev); n.delete(intervention.id); return n; });
    }
  }, [sid, executeInterventionMut, executingIds, executedIds]);

  // ── Execute all interventions at once ──
  const handleExecuteAll = useCallback(async () => {
    for (const intervention of interventions) {
      if (!executedIds.has(intervention.id)) {
        await handleExecuteIntervention(intervention);
      }
    }
  }, [interventions, executedIds, handleExecuteIntervention]);

  // ── Execute command ──
  const executeCommand = useCallback(async (input?: string) => {
    const cmd = input || query;
    if (!cmd.trim()) return;

    const classified = classifyCommand(cmd);

    // Navigate
    if (classified.intent === 'navigate' && classified.navigateTarget) {
      onNavigate?.(classified.navigateTarget);
      handleClose();
      return;
    }

    // Somatic state or query → route through AI Command Processor
    if (classified.intent === 'somatic' || classified.intent === 'query') {
      setPhase('processing');
      try {
        if (processCommandAction) {
          const result = await processCommandAction({ input: cmd, sessionId: sid, bioSnapshot: snapshot });
          if (result) {
            setResponseType(result.type || 'ai_query');
            setAiResponse(result.response || '');
            setInterventions(result.interventions || []);
            setPhase('result');
            return;
          }
        }
        // Fallback to sendMessage
        const result = await sendMessage(cmd, snapshot as BioSnapshot);
        setResponseType('ai_query');
        setAiResponse(result.text || '');
        setInterventions([]);
        setPhase('result');
      } catch {
        setAiResponse('AI Brain temporarily unavailable. Try again in a moment.');
        setInterventions([]);
        setPhase('error');
      }
      return;
    }

    // Quick-log
    if (classified.intent === 'log') {
      setPhase('processing');
      try {
        // Try AI quick-log parser first
        if (parseQuickLog) {
          const result = await parseQuickLog({ input: cmd, sessionId: sid });
          if (result?.success) {
            // Also route through command processor for contextual feedback
            if (processCommandAction) {
              try {
                const aiResult = await processCommandAction({ input: cmd, sessionId: sid, bioSnapshot: snapshot });
                if (aiResult?.response) {
                  setResponseType(aiResult.type || 'supplement_log');
                  setAiResponse(aiResult.response);
                  setInterventions([]);
                  setPhase('result');
                  return;
                }
              } catch { /* fall through to simple result */ }
            }
            setLogResult({ success: true, message: result.summary || 'Logged successfully', icon: '✓' });
            setPhase('result');
            if (result.bodyRegion) {
              window.dispatchEvent(new CustomEvent('vive-somatic-pulse', { detail: { region: result.bodyRegion, category: result.category } }));
            }
            setTimeout(handleClose, 2500);
            return;
          }
        }

        // Local vital parsing fallback
        const vitalMatch = cmd.match(/(?:hrv|heart\s*rate|hr|rhr)\s*[:=]?\s*(\d+)/i);
        if (vitalMatch) {
          const val = parseInt(vitalMatch[1]);
          const metric = cmd.toLowerCase().includes('hrv') ? 'hrv' : 'heartRate';
          await logVital({ sessionId: sid, vitalType: metric, value: val, unit: metric === 'hrv' ? 'ms' : 'bpm' });
          setLogResult({ success: true, message: `${metric === 'hrv' ? 'HRV' : 'Heart Rate'}: ${val}${metric === 'hrv' ? 'ms' : 'bpm'} logged`, icon: '♡' });
          setPhase('result');
          setTimeout(handleClose, 2500);
          return;
        }
        const sleepMatch = cmd.match(/(?:slept?|sleep)\s*[:=]?\s*(\d+\.?\d*)\s*(?:hours?|hrs?|h)?/i);
        if (sleepMatch) {
          const hours = parseFloat(sleepMatch[1]);
          await logVital({ sessionId: sid, vitalType: 'sleep_hours', value: hours, unit: 'hours' });
          setLogResult({ success: true, message: `Sleep: ${hours}h logged`, icon: '😴' });
          setPhase('result');
          setTimeout(handleClose, 2500);
          return;
        }
        const moodMatch = cmd.match(/(?:mood|energy)\s*[:=]?\s*(\d)/i);
        if (moodMatch) {
          const val = parseInt(moodMatch[1]);
          const isMood = cmd.toLowerCase().includes('mood');
          await logMoodEnergy({ sessionId: sid, mood: isMood ? val : 3, energy: isMood ? 3 : val });
          setLogResult({ success: true, message: `${isMood ? 'Mood' : 'Energy'}: ${val}/5 logged`, icon: '⚡' });
          setPhase('result');
          setTimeout(handleClose, 2500);
          return;
        }

        // Route through command processor for contextual feedback
        if (processCommandAction) {
          const aiResult = await processCommandAction({ input: cmd, sessionId: sid, bioSnapshot: snapshot });
          if (aiResult?.response) {
            setResponseType(aiResult.type || 'supplement_log');
            setAiResponse(aiResult.response);
            setInterventions([]);
            setPhase('result');
            return;
          }
        }

        setLogResult({ success: true, message: 'Entry logged', icon: '✓' });
        setPhase('result');
        setTimeout(handleClose, 2500);
      } catch {
        setLogResult({ success: false, message: 'Failed to log entry', icon: '✕' });
        setPhase('error');
      }
      return;
    }

    // Unknown → try AI
    setPhase('processing');
    try {
      if (processCommandAction) {
        const result = await processCommandAction({ input: cmd, sessionId: sid, bioSnapshot: snapshot });
        if (result?.response) {
          setResponseType(result.type || 'ai_query');
          setAiResponse(result.response);
          setInterventions(result.interventions || []);
          setPhase('result');
          return;
        }
      }
      const result = await sendMessage(cmd, snapshot as BioSnapshot);
      setResponseType('ai_query');
      setAiResponse(result.text || '');
      setPhase('result');
    } catch {
      setAiResponse('AI Brain temporarily unavailable.');
      setPhase('error');
    }
  }, [query, sid, snapshot, sendMessage, processCommandAction, parseQuickLog, logVital, logMoodEnergy, onNavigate, handleClose]);

  // ── Keyboard navigation ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (phase === 'idle' || phase === 'error') {
        if (filteredNav.length > 0 && classification?.intent === 'navigate') {
          onNavigate?.(filteredNav[selectedIdx]?.id || filteredNav[0]?.id);
          handleClose();
        } else {
          executeCommand();
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, Math.max(filteredNav.length - 1, SUGGESTIONS.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    }
  }, [phase, filteredNav, classification, selectedIdx, executeCommand, onNavigate, handleClose]);

  // ── Voice input ──
  const startVoice = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      setIsListening(false);
      setTimeout(() => executeCommand(transcript), 300);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }, [executeCommand]);

  // ── Intent badge ──
  const intentBadge = useMemo(() => {
    if (!classification || !query.trim()) return null;
    switch (classification.intent) {
      case 'query': return { label: 'AI QUERY', color: HUD.cyan, icon: '◉' };
      case 'log': return { label: 'QUICK LOG', color: HUD.green, icon: '⚡' };
      case 'navigate': return { label: 'NAVIGATE', color: HUD.gold, icon: '→' };
      case 'somatic': return { label: 'SOMATIC DETECT', color: HUD.orange, icon: '🧠' };
      default: return null;
    }
  }, [classification, query]);

  if (!isOpen) return null;

  const allExecuted = interventions.length > 0 && interventions.every(i => executedIds.has(i.id));

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
        animation: 'cmdFadeIn 0.15s ease-out',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 660,
        background: HUD.surface,
        border: `1px solid ${HUD.border}`,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: `0 0 80px rgba(196, 164, 108, 0.06), 0 32px 64px rgba(0,0,0,0.6)`,
        animation: 'cmdSlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* ── Input Area ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 20px',
          borderBottom: `1px solid ${HUD.border}`,
        }}>
          <div style={{
            width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: phase === 'processing' ? HUD.gold : HUD.textDim, fontSize: 14,
          }}>
            {phase === 'processing' ? (
              <div style={{
                width: 16, height: 16, border: `2px solid ${HUD.border}`,
                borderTopColor: HUD.gold, borderRadius: '50%',
                animation: 'cmdSpin 0.6s linear infinite',
              }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            )}
          </div>

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPhase('idle'); setAiResponse(null); setLogResult(null); setInterventions([]); }}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything, log data, or say how you feel..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: HUD.text, fontSize: 15, fontFamily: "'Inter', system-ui, sans-serif",
              fontWeight: 400, letterSpacing: '0.01em',
            }}
            autoComplete="off"
            spellCheck={false}
          />

          {intentBadge && phase === 'idle' && (
            <div style={{
              padding: '3px 10px', borderRadius: 6,
              background: `${intentBadge.color}15`,
              border: `1px solid ${intentBadge.color}30`,
              fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
              color: intentBadge.color,
              fontFamily: "'Inter', system-ui, sans-serif",
              display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
            }}>
              <span>{intentBadge.icon}</span>
              {intentBadge.label}
            </div>
          )}

          <button
            onClick={startVoice}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: isListening ? 'rgba(255, 107, 107, 0.15)' : 'transparent',
              border: `1px solid ${isListening ? 'rgba(255, 107, 107, 0.4)' : HUD.border}`,
              color: isListening ? HUD.red : HUD.textDim,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s', fontSize: 14,
            }}
            title="Voice command"
          >
            🎙
          </button>

          <div style={{
            padding: '3px 8px', borderRadius: 5,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${HUD.border}`,
            fontSize: 10, color: HUD.textDim,
            fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 500,
          }}>
            ESC
          </div>
        </div>

        {/* ── Content Area ── */}
        <div ref={resultRef} style={{
          maxHeight: 480, overflowY: 'auto',
          scrollbarWidth: 'thin', scrollbarColor: `${HUD.border} transparent`,
        }}>
          {/* Processing */}
          {phase === 'processing' && (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <div style={{
                fontSize: 10, letterSpacing: '0.2em', fontWeight: 600,
                color: HUD.gold, fontFamily: "'Inter', system-ui, sans-serif", marginBottom: 8,
              }}>
                {classification?.intent === 'somatic' ? 'ANALYZING BIOLOGICAL STATE' : classification?.intent === 'log' ? 'LOGGING ENTRY' : 'QUERYING AI BRAIN'}
              </div>
              <div style={{
                width: 120, height: 2, margin: '0 auto',
                background: HUD.border, borderRadius: 4, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: '60%',
                  background: `linear-gradient(90deg, ${HUD.gold}, ${HUD.orange})`,
                  borderRadius: 4, animation: 'cmdProgress 1.2s ease-in-out infinite',
                }} />
              </div>
              <div style={{
                marginTop: 12, fontSize: 11, color: HUD.textDim,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}>
                {classification?.intent === 'somatic'
                  ? 'Cross-referencing somatic state with Bio-Vault data...'
                  : classification?.intent === 'log'
                    ? 'Parsing and logging your entry...'
                    : 'Analyzing your biological data...'}
              </div>
            </div>
          )}

          {/* Log result (simple) */}
          {phase === 'result' && logResult && !aiResponse && (
            <div style={{ padding: '24px 20px', textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', margin: '0 auto 12px',
                background: logResult.success ? 'rgba(74, 222, 128, 0.1)' : 'rgba(255, 107, 107, 0.1)',
                border: `1px solid ${logResult.success ? 'rgba(74, 222, 128, 0.3)' : 'rgba(255, 107, 107, 0.3)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}>
                {logResult.icon}
              </div>
              <div style={{
                fontSize: 13, fontWeight: 600, color: logResult.success ? HUD.green : HUD.red,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}>
                {logResult.message}
              </div>
              <div style={{
                marginTop: 8, fontSize: 10, color: HUD.textDim,
                fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '0.1em',
              }}>
                AUTO-CLOSING...
              </div>
            </div>
          )}

          {/* ── AI Response with Intervention Cards ── */}
          {(phase === 'result' || phase === 'error') && aiResponse && (
            <div style={{ padding: '16px 20px' }}>
              {/* Response header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: responseType === 'somatic_intervention' ? HUD.orange : phase === 'error' ? HUD.red : HUD.gold,
                  boxShadow: `0 0 8px ${responseType === 'somatic_intervention' ? HUD.orange : phase === 'error' ? HUD.red : HUD.gold}40`,
                }} />
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
                  color: responseType === 'somatic_intervention' ? HUD.orange : phase === 'error' ? HUD.red : HUD.gold,
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}>
                  {responseType === 'somatic_intervention' ? 'SOMATIC ANALYSIS' :
                   responseType === 'affirmation' ? 'PEAK STATE DETECTED' :
                   responseType === 'food_log' ? 'NUTRITION ANALYSIS' :
                   responseType === 'supplement_log' ? 'PROTOCOL LOG' :
                   phase === 'error' ? 'SYSTEM ERROR' : 'AI BRAIN RESPONSE'}
                </span>
              </div>

              {/* Response text */}
              <div style={{
                fontSize: 13, lineHeight: 1.75, color: HUD.text,
                fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 400,
                padding: '14px 16px',
                background: responseType === 'somatic_intervention'
                  ? 'rgba(232, 151, 108, 0.06)'
                  : HUD.goldGlow,
                border: `1px solid ${responseType === 'somatic_intervention' ? 'rgba(232, 151, 108, 0.15)' : HUD.border}`,
                borderRadius: 12,
              }}>
                {aiResponse}
              </div>

              {/* ── Intervention Cards (Execute?) ── */}
              {interventions.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 10,
                  }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.15em',
                      color: HUD.orange, fontFamily: "'Inter', system-ui, sans-serif",
                    }}>
                      RECOMMENDED INTERVENTIONS
                    </span>
                    {!allExecuted && interventions.length > 1 && (
                      <button
                        onClick={handleExecuteAll}
                        style={{
                          padding: '4px 12px', borderRadius: 6,
                          background: 'rgba(74, 222, 128, 0.1)',
                          border: '1px solid rgba(74, 222, 128, 0.25)',
                          color: HUD.green, fontSize: 9, fontWeight: 700,
                          letterSpacing: '0.1em', cursor: 'pointer',
                          fontFamily: "'Inter', system-ui, sans-serif",
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74, 222, 128, 0.18)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(74, 222, 128, 0.1)'; }}
                      >
                        ⚡ EXECUTE ALL
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {interventions.map((intervention) => {
                      const isExecuting = executingIds.has(intervention.id);
                      const isExecuted = executedIds.has(intervention.id);

                      return (
                        <div
                          key={intervention.id}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 12,
                            background: isExecuted
                              ? 'rgba(74, 222, 128, 0.06)'
                              : 'rgba(255, 255, 255, 0.02)',
                            border: `1px solid ${isExecuted ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255, 255, 255, 0.06)'}`,
                            transition: 'all 0.25s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>
                              {intervention.icon}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{
                                  fontSize: 12, fontWeight: 700, color: isExecuted ? HUD.green : HUD.text,
                                  fontFamily: "'Inter', system-ui, sans-serif",
                                  textDecoration: isExecuted ? 'line-through' : 'none',
                                  textDecorationColor: 'rgba(74, 222, 128, 0.3)',
                                }}>
                                  {intervention.name}
                                </span>
                                {intervention.dosage && (
                                  <span style={{
                                    padding: '1px 6px', borderRadius: 4,
                                    background: 'rgba(196, 164, 108, 0.1)',
                                    border: '1px solid rgba(196, 164, 108, 0.15)',
                                    fontSize: 9, fontWeight: 600, color: HUD.gold,
                                    fontFamily: "'Inter', system-ui, sans-serif",
                                  }}>
                                    {intervention.dosage}
                                  </span>
                                )}
                                {intervention.duration && !intervention.dosage && (
                                  <span style={{
                                    padding: '1px 6px', borderRadius: 4,
                                    background: 'rgba(103, 232, 249, 0.08)',
                                    border: '1px solid rgba(103, 232, 249, 0.15)',
                                    fontSize: 9, fontWeight: 600, color: HUD.cyan,
                                    fontFamily: "'Inter', system-ui, sans-serif",
                                  }}>
                                    {intervention.duration}
                                  </span>
                                )}
                              </div>
                              <div style={{
                                fontSize: 10, lineHeight: 1.5, color: HUD.textDim,
                                fontFamily: "'Inter', system-ui, sans-serif",
                              }}>
                                {intervention.mechanism.length > 120
                                  ? intervention.mechanism.slice(0, 120) + '...'
                                  : intervention.mechanism}
                              </div>
                              <div style={{
                                marginTop: 6, display: 'flex', alignItems: 'center', gap: 8,
                              }}>
                                <span style={{
                                  fontSize: 9, fontWeight: 600, color: HUD.textMuted,
                                  fontFamily: "'Inter', system-ui, sans-serif",
                                }}>
                                  ⏱ {intervention.timeToEffect}
                                </span>
                                <span style={{
                                  padding: '1px 6px', borderRadius: 4,
                                  background: `rgba(255,255,255,0.03)`,
                                  fontSize: 8, fontWeight: 700, color: HUD.textMuted,
                                  fontFamily: "'Inter', system-ui, sans-serif",
                                  letterSpacing: '0.06em', textTransform: 'uppercase',
                                }}>
                                  {intervention.category}
                                </span>
                              </div>
                            </div>

                            {/* Execute button */}
                            <button
                              onClick={() => handleExecuteIntervention(intervention)}
                              disabled={isExecuting || isExecuted}
                              style={{
                                padding: '6px 14px', borderRadius: 8, flexShrink: 0,
                                background: isExecuted
                                  ? 'rgba(74, 222, 128, 0.12)'
                                  : isExecuting
                                    ? 'rgba(196, 164, 108, 0.08)'
                                    : 'rgba(74, 222, 128, 0.08)',
                                border: `1px solid ${isExecuted ? 'rgba(74, 222, 128, 0.3)' : isExecuting ? 'rgba(196, 164, 108, 0.2)' : 'rgba(74, 222, 128, 0.2)'}`,
                                color: isExecuted ? HUD.green : isExecuting ? HUD.gold : HUD.green,
                                fontSize: 10, fontWeight: 700,
                                fontFamily: "'Inter', system-ui, sans-serif",
                                letterSpacing: '0.08em',
                                cursor: isExecuted || isExecuting ? 'default' : 'pointer',
                                transition: 'all 0.2s',
                                opacity: isExecuting ? 0.6 : 1,
                              }}
                              onMouseEnter={(e) => {
                                if (!isExecuted && !isExecuting) e.currentTarget.style.background = 'rgba(74, 222, 128, 0.15)';
                              }}
                              onMouseLeave={(e) => {
                                if (!isExecuted && !isExecuting) e.currentTarget.style.background = 'rgba(74, 222, 128, 0.08)';
                              }}
                            >
                              {isExecuted ? '✓ ADDED' : isExecuting ? '...' : 'EXECUTE'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* All executed confirmation */}
                  {allExecuted && (
                    <div style={{
                      marginTop: 10, padding: '10px 14px', borderRadius: 10,
                      background: 'rgba(74, 222, 128, 0.06)',
                      border: '1px solid rgba(74, 222, 128, 0.15)',
                      textAlign: 'center',
                    }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
                        color: HUD.green, fontFamily: "'Inter', system-ui, sans-serif",
                      }}>
                        ✓ ALL INTERVENTIONS ADDED TO YOUR PROTOCOL STACK
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Follow-up */}
              <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setPhase('idle'); setAiResponse(null); setInterventions([]); setQuery(''); inputRef.current?.focus(); }}
                  style={{
                    padding: '6px 14px', borderRadius: 8,
                    background: 'transparent',
                    border: `1px solid ${HUD.border}`,
                    color: HUD.textDim, fontSize: 11, fontWeight: 500,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = HUD.borderActive; e.currentTarget.style.color = HUD.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = HUD.border; e.currentTarget.style.color = HUD.textDim; }}
                >
                  Ask follow-up →
                </button>
                {onNavigate && (
                  <button
                    onClick={() => { onNavigate('protocols'); handleClose(); }}
                    style={{
                      padding: '6px 14px', borderRadius: 8,
                      background: 'rgba(167, 139, 250, 0.06)',
                      border: '1px solid rgba(167, 139, 250, 0.2)',
                      color: HUD.violet, fontSize: 11, fontWeight: 500,
                      fontFamily: "'Inter', system-ui, sans-serif",
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(167, 139, 250, 0.12)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(167, 139, 250, 0.06)'; }}
                  >
                    ✦ View Protocol Stack
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Navigation results */}
          {phase === 'idle' && filteredNav.length > 0 && classification?.intent === 'navigate' && (
            <div style={{ padding: '8px 0' }}>
              <div style={{
                padding: '6px 20px', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.18em', color: HUD.textDim,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}>
                NAVIGATION
              </div>
              {filteredNav.map((nav, i) => (
                <button
                  key={nav.id}
                  onClick={() => { onNavigate?.(nav.id); handleClose(); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 20px',
                    background: i === selectedIdx ? HUD.goldGlow : 'transparent',
                    border: 'none', cursor: 'pointer', transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = HUD.goldGlow; setSelectedIdx(i); }}
                  onMouseLeave={(e) => { if (i !== selectedIdx) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{nav.icon}</span>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: HUD.text, fontFamily: "'Inter', system-ui, sans-serif" }}>
                      {nav.label}
                    </div>
                    <div style={{ fontSize: 11, color: HUD.textDim, fontFamily: "'Inter', system-ui, sans-serif" }}>
                      {nav.description}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: HUD.textMuted }}>↵</span>
                </button>
              ))}
            </div>
          )}

          {/* Default suggestions */}
          {phase === 'idle' && !query.trim() && (
            <div style={{ padding: '8px 0' }}>
              <div style={{
                padding: '6px 20px', fontSize: 9, fontWeight: 700,
                letterSpacing: '0.18em', color: HUD.textDim,
                fontFamily: "'Inter', system-ui, sans-serif",
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ color: HUD.gold }}>◉</span>
                TRY SAYING
              </div>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => { setQuery(s.text); setTimeout(() => executeCommand(s.text), 100); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 20px',
                    background: i === selectedIdx ? HUD.goldGlow : 'transparent',
                    border: 'none', cursor: 'pointer', transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = HUD.goldGlow; setSelectedIdx(i); }}
                  onMouseLeave={(e) => { if (i !== selectedIdx) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 14, width: 24, textAlign: 'center' }}>{s.icon}</span>
                  <span style={{
                    flex: 1, textAlign: 'left', fontSize: 13, color: HUD.text,
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}>
                    {s.text}
                  </span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4,
                    background: s.intent === 'somatic' ? 'rgba(232, 151, 108, 0.08)' : s.intent === 'query' ? 'rgba(103, 232, 249, 0.08)' : s.intent === 'log' ? 'rgba(74, 222, 128, 0.08)' : HUD.goldGlow,
                    fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
                    color: s.intent === 'somatic' ? HUD.orange : s.intent === 'query' ? HUD.cyan : s.intent === 'log' ? HUD.green : HUD.gold,
                    fontFamily: "'Inter', system-ui, sans-serif",
                  }}>
                    {s.intent === 'somatic' ? 'DETECT' : s.intent === 'query' ? 'ASK' : s.intent === 'log' ? 'LOG' : 'GO'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Idle with query — press Enter hint */}
          {phase === 'idle' && query.trim() && filteredNav.length === 0 && classification?.intent !== 'navigate' && (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{
                fontSize: 11, color: HUD.textDim,
                fontFamily: "'Inter', system-ui, sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 4,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${HUD.border}`,
                  fontSize: 10, fontWeight: 600,
                }}>
                  ↵
                </span>
                Press Enter to {classification?.intent === 'somatic' ? 'analyze your state' : classification?.intent === 'log' ? 'log this entry' : 'ask the AI Brain'}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '10px 20px',
          borderTop: `1px solid ${HUD.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            fontSize: 10, color: HUD.textDim,
            fontFamily: "'Inter', system-ui, sans-serif",
          }}>
            {[
              { keys: '↑↓', label: 'Navigate' },
              { keys: '↵', label: 'Execute' },
              { keys: '🎙', label: 'Voice' },
            ].map(({ keys, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  padding: '1px 5px', borderRadius: 3,
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${HUD.border}`, fontSize: 9,
                }}>{keys}</span>
                {label}
              </span>
            ))}
          </div>
          <div style={{
            fontSize: 9, color: HUD.textMuted,
            fontFamily: "'Inter', system-ui, sans-serif",
            letterSpacing: '0.1em',
          }}>
            VIVE AI BRAIN
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cmdFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes cmdSlideIn { from { opacity: 0; transform: translateY(-12px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes cmdSpin { to { transform: rotate(360deg); } }
        @keyframes cmdProgress { 0% { transform: translateX(-100%); } 50% { transform: translateX(60%); } 100% { transform: translateX(200%); } }
      `}</style>
    </div>
  );
}
