import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

/* ═══════════════════════════════════════════════════════════════
   GHOST-LOGGER — Zero-Friction Nutrition Intelligence Terminal
   
   "Steak and espresso" → instant macro breakdown + inflammation
   projection based on the user's existing blood lab data.
   
   Features:
   - Text input with typewriter placeholder
   - AI-powered meal parsing with local fallback
   - Real-time inflammation score projection
   - Glycemic load estimation from bioVault data
   - Animated result cards with mechanism explanations
   - Recent ghost-log history feed
   ═══════════════════════════════════════════════════════════════ */

interface GhostLoggerProps {
  sessionId: string;
  onClose?: () => void;
  compact?: boolean;
}

interface ParsedItem {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  inflammatoryIndex: number;
}

interface GhostResult {
  success: boolean;
  items: ParsedItem[];
  totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  mealType: string;
  qualityScore: number;
  inflammationProjection: {
    currentCRP: number | null;
    projectedCRPDelta: number;
    inflammationScore: number;
    riskLevel: 'low' | 'moderate' | 'elevated' | 'high';
    mechanism: string;
    timeToImpact: string;
    recommendation: string;
  };
  longevityFlags: string[];
  concerns: string[];
  source: 'ai' | 'local' | 'pending';
  analysisStatus?: 'pending' | 'analyzed';
  error: string | null;
}

/* ── Glycemic Load Estimation ── */
function estimateGlycemicLoad(items: ParsedItem[], totals: { carbs: number; fiber: number }): {
  glycemicLoad: number;
  glycemicIndex: number;
  classification: 'low' | 'moderate' | 'high';
  glucoseProjection: string;
} {
  const netCarbs = Math.max(0, totals.carbs - (totals.fiber || 0));
  
  let avgGI = 50;
  const highGIFoods = ['bread', 'rice', 'pasta', 'potato', 'sugar', 'soda', 'candy', 'donut', 'fries', 'pizza'];
  const lowGIFoods = ['eggs', 'steak', 'chicken', 'salmon', 'avocado', 'nuts', 'berries', 'broccoli', 'spinach'];
  
  let giSum = 0;
  let giCount = 0;
  for (const item of items) {
    const lower = item.name.toLowerCase();
    if (highGIFoods.some(f => lower.includes(f))) { giSum += 75; giCount++; }
    else if (lowGIFoods.some(f => lower.includes(f))) { giSum += 25; giCount++; }
    else { giSum += 50; giCount++; }
  }
  if (giCount > 0) avgGI = Math.round(giSum / giCount);
  
  const glycemicLoad = Math.round((avgGI * netCarbs) / 100);
  const classification = glycemicLoad <= 10 ? 'low' : glycemicLoad <= 19 ? 'moderate' : 'high';
  
  const glucoseProjection = glycemicLoad <= 10
    ? 'Minimal glucose spike expected. Insulin response will be blunted.'
    : glycemicLoad <= 19
      ? 'Moderate glucose elevation. Consider a 15-min post-meal walk to reduce spike by 30%.'
      : 'Significant glucose spike projected. Pair with protein/fat or add vinegar to attenuate response.';
  
  return { glycemicLoad, glycemicIndex: avgGI, classification, glucoseProjection };
}

/* ── Placeholder Rotation ── */
const PLACEHOLDERS = [
  'Steak and espresso...',
  '3 eggs, avocado, black coffee...',
  'Salmon bowl with quinoa...',
  'Protein shake and almonds...',
  'Chicken salad, no dressing...',
  'Oatmeal with berries and walnuts...',
];

/* ── Risk Level Colors ── */
const RISK_COLORS: Record<string, { bg: string; text: string; glow: string; border: string }> = {
  low: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', glow: 'shadow-emerald-500/20', border: 'border-emerald-500/30' },
  moderate: { bg: 'bg-amber-500/10', text: 'text-amber-400', glow: 'shadow-amber-500/20', border: 'border-amber-500/30' },
  elevated: { bg: 'bg-orange-500/10', text: 'text-orange-400', glow: 'shadow-orange-500/20', border: 'border-orange-500/30' },
  high: { bg: 'bg-red-500/10', text: 'text-red-400', glow: 'shadow-red-500/20', border: 'border-red-500/30' },
};

const GL_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  moderate: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  high: { bg: 'bg-red-500/10', text: 'text-red-400' },
};

export default function GhostLogger({ sessionId, onClose, compact = false }: GhostLoggerProps) {
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<'idle' | 'processing' | 'result' | 'committed'>('idle');
  const [result, setResult] = useState<GhostResult | null>(null);
  const [glycemic, setGlycemic] = useState<ReturnType<typeof estimateGlycemicLoad> | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scanLineRef = useRef<HTMLDivElement>(null);

  const processGhostLog = useAction(api.ghostLog.processGhostLog);
  const commitGhostLog = useMutation(api.ghostLog.commitGhostLog);
  const recentLogs = useQuery(api.ghostLog.getRecentGhostLogs, { sessionId });

  // Rotate placeholder
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-focus
  useEffect(() => {
    if (phase === 'idle') inputRef.current?.focus();
  }, [phase]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || phase === 'processing') return;
    setPhase('processing');
    setError(null);
    setResult(null);
    setGlycemic(null);

    try {
      const res = await processGhostLog({
        input: input.trim(),
        sessionId,
        isPhoto: false,
      });
      
      if (res.success) {
        setResult(res as GhostResult);
        const pending = (res as any).source === 'pending' || (res as any).analysisStatus === 'pending';
        if (!pending) {
          setGlycemic(estimateGlycemicLoad(res.items, res.totals));
        }
        setPhase('result');
      } else {
        setError(res.error || 'Failed to parse meal');
        setPhase('idle');
      }
    } catch (err: any) {
      setError(err?.message || 'Processing failed');
      setPhase('idle');
    }
  }, [input, phase, processGhostLog, sessionId]);

  const handleCommit = useCallback(async () => {
    if (!result) return;
    try {
      const status = result.analysisStatus
        ?? (result.source === 'pending' ? 'pending' : 'analyzed');
      await commitGhostLog({
        sessionId,
        input: input.trim(),
        items: result.items,
        totals: result.totals,
        mealType: result.mealType,
        qualityScore: result.qualityScore,
        inflammationScore: result.inflammationProjection.inflammationScore,
        projectedCRPDelta: result.inflammationProjection.projectedCRPDelta,
        source: result.source,
        analysisStatus: status,
      });
      setPhase('committed');
      setTimeout(() => {
        setPhase('idle');
        setInput('');
        setResult(null);
        setGlycemic(null);
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to commit');
    }
  }, [result, commitGhostLog, sessionId, input]);

  const handleReset = useCallback(() => {
    setPhase('idle');
    setInput('');
    setResult(null);
    setGlycemic(null);
    setError(null);
  }, []);

  const riskStyle = result ? RISK_COLORS[result.inflammationProjection.riskLevel] || RISK_COLORS.low : RISK_COLORS.low;
  const glStyle = glycemic ? GL_COLORS[glycemic.classification] || GL_COLORS.low : GL_COLORS.low;

  return (
    <div className={`relative ${compact ? '' : 'min-h-[500px]'}`}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center">
            <span className="text-sm">👻</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide">GHOST-LOG</h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest">Zero-Friction Nutrition Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-[10px] px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/10 transition-all"
          >
            {showHistory ? '✕ CLOSE' : '📋 HISTORY'}
          </button>
          {onClose && (
            <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors text-xs">✕</button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ═══ IDLE — Input Phase ═══ */}
        {phase === 'idle' && !showHistory && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500/20 via-cyan-500/20 to-violet-500/20 rounded-xl blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-4">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder={PLACEHOLDERS[placeholderIdx]}
                  rows={2}
                  className="w-full bg-transparent text-white/90 text-sm placeholder:text-white/20 resize-none outline-none font-mono"
                />
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-white/25 uppercase tracking-widest">Enter meal description</span>
                    <span className="text-[9px] text-white/15">|</span>
                    <span className="text-[9px] text-white/25">⏎ to analyze</span>
                  </div>
                  <button
                    onClick={handleSubmit}
                    disabled={!input.trim()}
                    className="px-4 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all duration-300 disabled:opacity-20 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500 shadow-lg shadow-violet-500/20"
                  >
                    ⚡ Analyze / Log
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs"
              >
                {error}
              </motion.div>
            )}

            {/* Quick suggestions */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {['Steak and espresso', '3 eggs, avocado, black coffee', 'Salmon bowl with rice', 'Protein shake'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 border border-white/8 text-white/35 hover:text-white/70 hover:bg-white/10 hover:border-white/20 transition-all duration-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ═══ PROCESSING — Scan Animation ═══ */}
        {phase === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-6 overflow-hidden"
          >
            {/* Scan line */}
            <motion.div
              ref={scanLineRef}
              className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
              animate={{ top: ['0%', '100%', '0%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
            
            <div className="text-center py-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-cyan-500/30 border-t-cyan-400"
              />
              <p className="text-sm text-white/60 font-mono">Parsing nutritional data...</p>
              <p className="text-[10px] text-white/30 mt-1 font-mono">Cross-referencing bioVault for inflammation projection</p>
              
              {/* Fake terminal output */}
              <div className="mt-4 text-left max-w-xs mx-auto space-y-1">
                {[
                  '> Tokenizing food items...',
                  '> Querying macro database...',
                  '> Loading bioVault CRP baseline...',
                  '> Computing inflammatory index...',
                ].map((line, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 0.4, x: 0 }}
                    transition={{ delay: i * 0.5, duration: 0.3 }}
                    className="text-[9px] font-mono text-cyan-400/50"
                  >
                    {line}
                  </motion.p>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ RESULT — Full Analysis Display ═══ */}
        {phase === 'result' && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="space-y-3"
          >
            {/* ── Parsed Items ── */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Parsed Items</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 text-white/30">
                  {result.source === 'pending' || result.analysisStatus === 'pending'
                    ? '⏳ Pending analysis'
                    : result.source === 'ai' ? '🧠 AI' : '📊 Local'} · {result.mealType}
                </span>
              </div>
              <div className="space-y-2">
                {result.items.map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/3 border border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-6 rounded-full ${
                        item.inflammatoryIndex < -0.5 ? 'bg-emerald-400' :
                        item.inflammatoryIndex > 0.5 ? 'bg-orange-400' : 'bg-white/20'
                      }`} />
                      <div>
                        <p className="text-xs text-white/80 font-medium">{item.name}</p>
                        <p className="text-[9px] text-white/30">{item.portion}</p>
                      </div>
                    </div>
                    {result.source !== 'pending' && result.analysisStatus !== 'pending' ? (
                    <div className="flex items-center gap-4 text-[10px] text-white/40">
                      <span>{item.calories}<span className="text-white/20">kcal</span></span>
                      <span className="text-cyan-400/60">{item.protein}P</span>
                      <span className="text-amber-400/60">{item.carbs}C</span>
                      <span className="text-orange-400/60">{item.fat}F</span>
                    </div>
                    ) : (
                      <span className="text-[9px] text-amber-400/60">Pending</span>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Totals bar — hide zeros claimed as macros when pending */}
              {result.source !== 'pending' && result.analysisStatus !== 'pending' && (
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-white/30 uppercase tracking-wider">Total</span>
                <div className="flex items-center gap-4 text-[11px] font-mono">
                  <span className="text-white/70">{result.totals.calories}<span className="text-white/30">kcal</span></span>
                  <span className="text-cyan-400">{result.totals.protein}g<span className="text-cyan-400/40">P</span></span>
                  <span className="text-amber-400">{result.totals.carbs}g<span className="text-amber-400/40">C</span></span>
                  <span className="text-orange-400">{result.totals.fat}g<span className="text-orange-400/40">F</span></span>
                </div>
              </div>
              )}
            </div>

            {/* ── Pending analysis (no invented macros) ── */}
            {(result.source === 'pending' || result.analysisStatus === 'pending') && (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4">
                <p className="text-xs text-amber-300 font-semibold">Pending analysis</p>
                <p className="text-[10px] text-white/45 mt-1 leading-relaxed">
                  AI nutrition analysis is unavailable. Your meal text will be saved with no calorie or macro estimates.
                  You can enter macros manually later.
                </p>
              </div>
            )}

            {/* ── Inflammation Projection (analyzed only) ── */}
            {result.source !== 'pending' && result.analysisStatus !== 'pending' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className={`relative bg-black/40 backdrop-blur-xl border rounded-xl p-4 overflow-hidden ${riskStyle.border}`}
            >
              {/* Glow effect */}
              <div className={`absolute inset-0 ${riskStyle.bg} opacity-30`} />
              
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">🔥 Inflammation Projection</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${riskStyle.bg} ${riskStyle.text} font-semibold uppercase`}>
                    {result.inflammationProjection.riskLevel}
                  </span>
                </div>

                {/* Score gauge */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-16 h-16">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/5" />
                      <circle
                        cx="18" cy="18" r="15.5" fill="none"
                        strokeWidth="2.5"
                        strokeDasharray={`${result.inflammationProjection.inflammationScore} ${100 - result.inflammationProjection.inflammationScore}`}
                        strokeLinecap="round"
                        className={riskStyle.text}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-lg font-bold ${riskStyle.text}`}>{result.inflammationProjection.inflammationScore}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-white/60 leading-relaxed">{result.inflammationProjection.mechanism}</p>
                    <p className="text-[9px] text-white/30 mt-1">⏱ {result.inflammationProjection.timeToImpact}</p>
                  </div>
                </div>

                {/* CRP delta */}
                {result.inflammationProjection.currentCRP !== null && (
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-white/3 mb-3">
                    <span className="text-[9px] text-white/30 uppercase tracking-wider">CRP Baseline</span>
                    <span className="text-[11px] text-white/60 font-mono">{result.inflammationProjection.currentCRP} mg/L</span>
                    <span className="text-[9px] text-white/20">→</span>
                    <span className={`text-[11px] font-mono ${result.inflammationProjection.projectedCRPDelta > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {result.inflammationProjection.projectedCRPDelta > 0 ? '+' : ''}{result.inflammationProjection.projectedCRPDelta} mg/L
                    </span>
                  </div>
                )}

                {/* Recommendation */}
                <div className="p-2.5 rounded-lg bg-white/3 border border-white/5">
                  <p className="text-[10px] text-white/50 leading-relaxed">💡 {result.inflammationProjection.recommendation}</p>
                </div>
              </div>
            </motion.div>
            )}

            {/* ── Glycemic Load Projection ── */}
            {glycemic && result.source !== 'pending' && result.analysisStatus !== 'pending' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">📊 Glycemic Load</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${glStyle.bg} ${glStyle.text} font-semibold uppercase`}>
                    {glycemic.classification}
                  </span>
                </div>
                <div className="flex items-center gap-6 mb-3">
                  <div className="text-center">
                    <p className={`text-2xl font-bold ${glStyle.text}`}>{glycemic.glycemicLoad}</p>
                    <p className="text-[8px] text-white/25 uppercase tracking-wider">GL Score</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white/50">{glycemic.glycemicIndex}</p>
                    <p className="text-[8px] text-white/25 uppercase tracking-wider">Avg GI</p>
                  </div>
                  <div className="flex-1">
                    {/* GL bar */}
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (glycemic.glycemicLoad / 30) * 100)}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full ${glycemic.classification === 'low' ? 'bg-emerald-400' : glycemic.classification === 'moderate' ? 'bg-amber-400' : 'bg-red-400'}`}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[8px] text-white/20">0</span>
                      <span className="text-[8px] text-white/20">10</span>
                      <span className="text-[8px] text-white/20">20</span>
                      <span className="text-[8px] text-white/20">30+</span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-white/40 leading-relaxed">🩸 {glycemic.glucoseProjection}</p>
              </motion.div>
            )}

            {/* ── Quality + Flags ── */}
            {result.source !== 'pending' && result.analysisStatus !== 'pending' && (
            <div className="flex gap-3">
              <div className="flex-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white/70">{result.qualityScore}<span className="text-sm text-white/30">/10</span></p>
                <p className="text-[8px] text-white/25 uppercase tracking-wider mt-1">Quality Score</p>
              </div>
              {result.longevityFlags.length > 0 && (
                <div className="flex-1 bg-black/40 backdrop-blur-xl border border-emerald-500/20 rounded-xl p-3">
                  <p className="text-[9px] text-emerald-400/60 uppercase tracking-wider mb-1">Longevity Flags</p>
                  {result.longevityFlags.map((flag, i) => (
                    <span key={i} className="text-[10px] text-emerald-400 mr-2">✓ {flag}</span>
                  ))}
                </div>
              )}
              {result.concerns.length > 0 && (
                <div className="flex-1 bg-black/40 backdrop-blur-xl border border-orange-500/20 rounded-xl p-3">
                  <p className="text-[9px] text-orange-400/60 uppercase tracking-wider mb-1">Concerns</p>
                  {result.concerns.map((concern, i) => (
                    <span key={i} className="text-[10px] text-orange-400 mr-2">⚠ {concern}</span>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* ── Action Buttons ── */}
            <div className="flex gap-2">
              <button
                onClick={handleCommit}
                className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-wider bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-500 hover:to-cyan-500 shadow-lg shadow-violet-500/20 transition-all duration-300"
              >
                {result.source === 'pending' || result.analysisStatus === 'pending'
                  ? '✓ Save text (pending analysis)'
                  : '✓ Commit to Log'}
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2.5 rounded-xl text-[11px] font-medium uppercase tracking-wider bg-white/5 border border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10 transition-all"
              >
                ✕ Discard
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══ COMMITTED — Success Flash ═══ */}
        {phase === 'committed' && (
          <motion.div
            key="committed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bg-black/40 backdrop-blur-xl border border-emerald-500/30 rounded-xl p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center"
            >
              <span className="text-2xl">✓</span>
            </motion.div>
            <p className="text-sm text-emerald-400 font-semibold">Logged to Ghost-Log</p>
            <p className="text-[10px] text-white/30 mt-1">Nutrition data committed to your biological timeline</p>
          </motion.div>
        )}

        {/* ═══ HISTORY — Recent Logs ═══ */}
        {showHistory && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-2"
          >
            {(!recentLogs || recentLogs.length === 0) ? (
              <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-8 text-center">
                <p className="text-white/30 text-xs">No ghost logs yet</p>
                <p className="text-white/15 text-[10px] mt-1">Log your first meal to see history</p>
              </div>
            ) : (
              recentLogs.slice(0, 8).map((log, i) => (
                <motion.div
                  key={log._id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-black/40 backdrop-blur-xl border border-white/8 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/60 truncate">{log.rawInput}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {(log as any).analysisStatus === 'pending' || (log.totalCalories === 0 && log.totalProtein === 0) ? (
                          <span className="text-[9px] text-amber-400/70 font-mono">Pending analysis</span>
                        ) : (
                          <>
                            <span className="text-[9px] text-white/30 font-mono">{log.totalCalories}kcal</span>
                            <span className="text-[9px] text-cyan-400/50">{log.totalProtein}P</span>
                            <span className="text-[9px] text-amber-400/50">{log.totalCarbs}C</span>
                            <span className="text-[9px] text-orange-400/50">{log.totalFat}F</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <div className={`text-[10px] font-semibold ${
                        (log as any).analysisStatus === 'pending' || log.inflammationScore === 0
                          ? 'text-amber-400/70'
                          : log.inflammationScore < 35 ? 'text-emerald-400' :
                            log.inflammationScore < 55 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {(log as any).analysisStatus === 'pending' || (log.totalCalories === 0 && log.inflammationScore === 0)
                          ? '—'
                          : `${log.inflammationScore}/100`}
                      </div>
                      <p className="text-[8px] text-white/20">
                        {new Date(log.loggedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}