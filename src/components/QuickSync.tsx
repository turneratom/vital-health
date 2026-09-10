import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
  type ParsedBiomarker,
  type BiomarkerCategory,
  parseBioLinkText,
  buildVaultMapping,
} from '../lib/LabResultParser';
import { getTwinSessionId } from '../lib/twinSession';

/* ═══════════════════════════════════════════════════════════════
   QUICK-SYNC — Zero-Friction Biomarker Ingestion Terminal
   
   Paste raw clinical lab text → instant parse → verify → commit.
   Maps ApoB, HbA1c, Vitamin D, etc. to Bio-Projection and
   triggers longevity forecast recalculation automatically.
   
   Designed for high-performance users who want to go from
   "lab results in hand" to "forecast updated" in under 10 seconds.
   ═══════════════════════════════════════════════════════════════ */

type SyncPhase = 'input' | 'parsing' | 'verify' | 'committing' | 'complete' | 'error';

interface VerifiedMarker extends ParsedBiomarker {
  id: string;
  isIncluded: boolean;
  isEditing: boolean;
  editValue: string;
  originalValue: number;
  isModified: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  hormones: '⚡', metabolic: '📊', lipids: '🫀', vitamins: '☀️',
  minerals: '💎', inflammation: '🔥', liver: '🟢', kidney: '🫘',
  thyroid: '🦋', hematology: '🩸', cardiac: '❤️', other: '🔬',
};

const CATEGORY_COLORS: Record<string, string> = {
  hormones: '#A855F7', metabolic: '#F59E0B', lipids: '#EF4444',
  vitamins: '#10B981', minerals: '#06B6D4', inflammation: '#F97316',
  liver: '#84CC16', kidney: '#8B5CF6', thyroid: '#EC4899',
  hematology: '#3B82F6', cardiac: '#EF4444', other: '#6B7280',
};

function statusColor(s: string) {
  if (s === 'optimal') return '#34D399';
  if (s === 'warning') return '#FFD60A';
  return '#FF453A';
}

function statusBadge(s: string) {
  if (s === 'optimal') return 'OPTIMAL';
  if (s === 'warning') return 'FLAG';
  return 'CRITICAL';
}

const EXAMPLE_TEXT = `Vitamin D (25-OH)  38.2  ng/mL  30-100
Ferritin  72  ng/mL  20-300
hs-CRP  1.2  mg/L  0-3
HbA1c  5.3  %  4-5.6
Testosterone (Total)  620  ng/dL  264-916
Testosterone (Free)  15.2  pg/mL  8.7-25.1
ApoB  82  mg/dL  0-90
LDL-C  105  mg/dL  0-100
HDL-C  58  mg/dL  40-60
Triglycerides  88  mg/dL  0-150`;

export function QuickSync({ onComplete }: { onComplete?: () => void }) {
  const [phase, setPhase] = useState<SyncPhase>('input');
  const [rawText, setRawText] = useState('');
  const [markers, setMarkers] = useState<VerifiedMarker[]>([]);
  const [unmatchedLines, setUnmatchedLines] = useState<string[]>([]);
  const [parseConfidence, setParseConfidence] = useState(0);
  const [commitProgress, setCommitProgress] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [forecastDelta, setForecastDelta] = useState<Record<string, { before: number | null; after: number; direction: string }>>({});
  const [errorMsg, setErrorMsg] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sessionId = typeof window !== 'undefined' ? getTwinSessionId() : '';
  const commitLabResults = useMutation(api.logs.commitLabResults);

  useEffect(() => {
    if (phase === 'input' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [phase]);

  /* ── Parse pasted text ── */
  const handleParse = useCallback(() => {
    if (!rawText.trim()) return;
    setPhase('parsing');

    // Simulate brief parsing delay for UX feel
    setTimeout(() => {
      try {
        const result = parseBioLinkText(rawText);

        if (result.biomarkers.length === 0) {
          setErrorMsg('No biomarkers detected. Try pasting lab results in a standard format (e.g., "Vitamin D  38.2  ng/mL").');
          setPhase('error');
          return;
        }

        const verified: VerifiedMarker[] = result.biomarkers.map((bm, i) => ({
          ...bm,
          id: `qs-${i}`,
          isIncluded: true,
          isEditing: false,
          editValue: '',
          originalValue: bm.value,
          isModified: false,
        }));

        setMarkers(verified);
        setUnmatchedLines(result.unmatchedLines);
        setParseConfidence(result.confidence);

        // Compute forecast delta preview for vault-mapped markers
        const delta: Record<string, { before: number | null; after: number; direction: string }> = {};
        for (const bm of verified) {
          if (bm.vaultKey) {
            delta[bm.vaultKey] = {
              before: null, // Would come from current bioVault
              after: bm.value,
              direction: bm.status === 'optimal' ? 'stable' : bm.status === 'warning' ? 'needs-attention' : 'critical-drift',
            };
          }
        }
        setForecastDelta(delta);
        setPhase('verify');
      } catch (err) {
        setErrorMsg('Failed to parse text. Please check the format and try again.');
        setPhase('error');
      }
    }, 400);
  }, [rawText]);

  /* ── Toggle marker inclusion ── */
  const toggleMarker = useCallback((id: string) => {
    setMarkers(prev => prev.map(m => m.id === id ? { ...m, isIncluded: !m.isIncluded } : m));
  }, []);

  /* ── Edit marker value ── */
  const startEdit = useCallback((id: string) => {
    setMarkers(prev => prev.map(m => m.id === id ? { ...m, isEditing: true, editValue: String(m.value) } : m));
  }, []);

  const confirmEdit = useCallback((id: string) => {
    setMarkers(prev => prev.map(m => {
      if (m.id !== id) return m;
      const numVal = parseFloat(m.editValue);
      if (isNaN(numVal) || numVal < 0) return { ...m, isEditing: false };
      return { ...m, value: numVal, isEditing: false, isModified: numVal !== m.originalValue };
    }));
  }, []);

  const cancelEdit = useCallback((id: string) => {
    setMarkers(prev => prev.map(m => m.id === id ? { ...m, isEditing: false } : m));
  }, []);

  /* ── Commit to BioVault ── */
  const handleCommit = useCallback(async () => {
    if (!sessionId) {
      setErrorMsg('No twin session found. Refresh and try again.');
      setPhase('error');
      return;
    }
    setPhase('committing');
    setCommitProgress(0);

    const steps = 15;
    for (let i = 1; i <= steps; i++) {
      await new Promise(r => setTimeout(r, 50));
      setCommitProgress(Math.round((i / steps) * 100));
    }

    const included = markers.filter(m => m.isIncluded);
    const vaultData = buildVaultMapping(included);

    try {
      await commitLabResults({
        sessionId,
        vitaminD: vaultData.vitaminD,
        ferritin: vaultData.ferritin,
        crp: vaultData.crp,
        hba1c: vaultData.hba1c,
        testosteroneTotal: vaultData.testosteroneTotal,
        testosteroneFree: vaultData.testosteroneFree,
      });

      // Dispatch event for Bio-Projection recalculation
      window.dispatchEvent(new CustomEvent('vive:lab-sync', {
        detail: {
          timestamp: Date.now(),
          analytes: included.length,
          vaultKeys: Object.keys(vaultData).filter(k => (vaultData as any)[k] !== undefined),
          source: 'quick-sync',
        },
      }));

      setPhase('complete');
    } catch (err) {
      setErrorMsg('Failed to commit to Bio-Vault. Please retry.');
      setPhase('error');
    }
  }, [sessionId, markers, commitLabResults]);

  /* ── Reset ── */
  const handleReset = useCallback(() => {
    setPhase('input');
    setRawText('');
    setMarkers([]);
    setUnmatchedLines([]);
    setParseConfidence(0);
    setCommitProgress(0);
    setActiveCategory(null);
    setForecastDelta({});
    setErrorMsg('');
  }, []);

  /* ── Load example ── */
  const loadExample = useCallback(() => {
    setRawText(EXAMPLE_TEXT);
    if (textareaRef.current) textareaRef.current.focus();
  }, []);

  /* ── Derived data ── */
  const categories = useMemo(() => {
    const cats = new Map<string, number>();
    for (const m of markers) cats.set(m.category, (cats.get(m.category) || 0) + 1);
    return Array.from(cats.entries()).sort((a, b) => b[1] - a[1]);
  }, [markers]);

  const filteredMarkers = useMemo(() => {
    if (!activeCategory) return markers;
    return markers.filter(m => m.category === activeCategory);
  }, [markers, activeCategory]);

  const includedCount = useMemo(() => markers.filter(m => m.isIncluded).length, [markers]);
  const vaultMappedCount = useMemo(() => markers.filter(m => m.isIncluded && m.vaultKey).length, [markers]);
  const flaggedCount = useMemo(() => markers.filter(m => m.status !== 'optimal').length, [markers]);
  const criticalCount = useMemo(() => markers.filter(m => m.status === 'critical').length, [markers]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 mb-3">
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={{ rotate: phase === 'parsing' ? 360 : 0 }}
            transition={{ duration: 1, repeat: phase === 'parsing' ? Infinity : 0, ease: 'linear' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(0,242,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </motion.div>
          <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: 'rgba(0,242,255,0.9)' }}>
            Quick-Sync
          </span>
        </div>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(0,242,255,0.2), transparent)' }} />
        <div className="flex items-center gap-1">
          <motion.div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: phase === 'complete' ? '#34D399' : phase === 'verify' ? '#F59E0B' : phase === 'parsing' || phase === 'committing' ? '#00F2FF' : 'rgba(0,242,255,0.3)',
              boxShadow: phase !== 'input' ? `0 0 6px ${phase === 'complete' ? 'rgba(52,211,153,0.5)' : phase === 'verify' ? 'rgba(245,158,11,0.5)' : 'rgba(0,242,255,0.5)'}` : 'none',
            }}
            animate={phase === 'parsing' || phase === 'committing' ? { opacity: [0.4, 1, 0.4] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-[8px] font-mono uppercase tracking-wider" style={{
            color: phase === 'complete' ? 'rgba(52,211,153,0.7)' : phase === 'verify' ? 'rgba(245,158,11,0.7)' : phase === 'parsing' ? 'rgba(0,242,255,0.7)' : 'rgba(0,242,255,0.4)',
          }}>
            {phase === 'input' ? 'READY' : phase === 'parsing' ? 'PARSING' : phase === 'verify' ? 'VERIFY' : phase === 'committing' ? 'SYNCING' : phase === 'complete' ? 'SYNCED' : 'ERROR'}
          </span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ═══ INPUT PHASE ═══ */}
        {phase === 'input' && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            <div className="rounded-xl overflow-hidden" style={{
              background: 'rgba(0,242,255,0.02)',
              border: '1px solid rgba(0,242,255,0.1)',
            }}>
              {/* Paste area */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleParse();
                  }}
                  placeholder="Paste your lab results here...&#10;&#10;Example formats:&#10;Vitamin D (25-OH)  38.2  ng/mL  30-100&#10;ApoB: 82 mg/dL&#10;HbA1c  5.3  %"
                  className="w-full min-h-[140px] max-h-[240px] resize-y px-3 py-3 text-[11px] font-mono leading-relaxed outline-none"
                  style={{
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.7)',
                    caretColor: '#00F2FF',
                  }}
                  spellCheck={false}
                />
                {/* Character count */}
                {rawText.length > 0 && (
                  <div className="absolute bottom-2 right-2 text-[8px] font-mono" style={{ color: 'rgba(0,242,255,0.3)' }}>
                    {rawText.length} chars &middot; {rawText.split('\n').filter(l => l.trim()).length} lines
                  </div>
                )}
              </div>

              {/* Action bar */}
              <div className="flex items-center justify-between px-3 py-2" style={{
                borderTop: '1px solid rgba(0,242,255,0.06)',
                background: 'rgba(0,0,0,0.15)',
              }}>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadExample}
                    className="text-[8px] font-mono uppercase tracking-wider px-2 py-1 rounded transition-all duration-200 hover:bg-white/[0.04]"
                    style={{ color: 'rgba(0,242,255,0.4)', border: '1px solid rgba(0,242,255,0.08)' }}
                  >
                    LOAD EXAMPLE
                  </button>
                  <span className="text-[7px] font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>
                    {'\u2318'}+Enter to parse
                  </span>
                </div>
                <button
                  onClick={handleParse}
                  disabled={!rawText.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: rawText.trim() ? 'linear-gradient(135deg, rgba(0,242,255,0.15), rgba(168,85,247,0.1))' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${rawText.trim() ? 'rgba(0,242,255,0.3)' : 'rgba(255,255,255,0.04)'}`,
                    color: rawText.trim() ? 'rgba(0,242,255,0.9)' : 'rgba(255,255,255,0.2)',
                    boxShadow: rawText.trim() ? '0 0 12px rgba(0,242,255,0.08)' : 'none',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  PARSE
                </button>
              </div>
            </div>

            {/* Supported formats hint */}
            <div className="flex flex-wrap gap-1.5 mt-2 px-1">
              {['ApoB', 'HbA1c', 'Vitamin D', 'Testosterone', 'hs-CRP', 'Ferritin', 'LDL-C', 'TSH'].map(name => (
                <span key={name} className="text-[7px] font-mono px-1.5 py-0.5 rounded-full" style={{
                  background: 'rgba(0,242,255,0.04)',
                  border: '1px solid rgba(0,242,255,0.08)',
                  color: 'rgba(0,242,255,0.35)',
                }}>
                  {name}
                </span>
              ))}
              <span className="text-[7px] font-mono px-1.5 py-0.5" style={{ color: 'rgba(255,255,255,0.15)' }}>
                +50 more biomarkers
              </span>
            </div>
          </motion.div>
        )}

        {/* ═══ PARSING PHASE ═══ */}
        {phase === 'parsing' && (
          <motion.div
            key="parsing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl py-8 flex flex-col items-center"
            style={{
              background: 'rgba(0,242,255,0.02)',
              border: '1px solid rgba(0,242,255,0.1)',
            }}
          >
            <motion.div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
              style={{
                background: 'rgba(0,242,255,0.06)',
                border: '1px solid rgba(0,242,255,0.2)',
                boxShadow: '0 0 24px rgba(0,242,255,0.1)',
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(0,242,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </motion.div>
            <span className="text-[11px] font-bold tracking-wide" style={{ color: 'rgba(0,242,255,0.9)' }}>
              PARSING BIOMARKERS
            </span>
            <span className="text-[9px] font-mono mt-1" style={{ color: 'rgba(0,242,255,0.4)' }}>
              Extracting clinical values from text...
            </span>
          </motion.div>
        )}

        {/* ═══ VERIFY PHASE ═══ */}
        {phase === 'verify' && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            {/* Stats bar */}
            <div className="flex items-center justify-between px-1 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold" style={{ color: 'rgba(0,242,255,0.9)' }}>
                  {markers.length} DETECTED
                </span>
                <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {parseConfidence}% confidence
                </span>
              </div>
              <div className="flex items-center gap-2">
                {flaggedCount > 0 && (
                  <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{
                    background: criticalCount > 0 ? 'rgba(255,69,58,0.08)' : 'rgba(255,214,10,0.08)',
                    color: criticalCount > 0 ? 'rgba(255,69,58,0.7)' : 'rgba(255,214,10,0.7)',
                    border: `1px solid ${criticalCount > 0 ? 'rgba(255,69,58,0.15)' : 'rgba(255,214,10,0.15)'}`,
                  }}>
                    {criticalCount > 0 ? `${criticalCount} CRITICAL` : `${flaggedCount} FLAGGED`}
                  </span>
                )}
                <button
                  onClick={handleReset}
                  className="text-[8px] font-mono uppercase tracking-wider px-2 py-1 rounded transition-all hover:bg-white/[0.04]"
                  style={{ color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  REDO
                </button>
              </div>
            </div>

            {/* Category filter chips */}
            <div className="flex gap-1 mb-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setActiveCategory(null)}
                className="text-[8px] font-mono uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap transition-all"
                style={{
                  background: !activeCategory ? 'rgba(0,242,255,0.1)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${!activeCategory ? 'rgba(0,242,255,0.25)' : 'rgba(255,255,255,0.04)'}`,
                  color: !activeCategory ? 'rgba(0,242,255,0.9)' : 'rgba(255,255,255,0.25)',
                }}
              >
                ALL ({markers.length})
              </button>
              {categories.map(([cat, count]) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
                  className="text-[8px] font-mono uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap transition-all flex items-center gap-1"
                  style={{
                    background: activeCategory === cat ? `${CATEGORY_COLORS[cat]}12` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${activeCategory === cat ? `${CATEGORY_COLORS[cat]}35` : 'rgba(255,255,255,0.04)'}`,
                    color: activeCategory === cat ? CATEGORY_COLORS[cat] : 'rgba(255,255,255,0.25)',
                  }}
                >
                  <span className="text-[8px]">{CATEGORY_ICONS[cat] || '🔬'}</span>
                  {cat} ({count})
                </button>
              ))}
            </div>

            {/* Marker list */}
            <div
              ref={scrollRef}
              className="max-h-[260px] overflow-y-auto rounded-lg scrollbar-none"
              style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.04)' }}
            >
              {/* Table header */}
              <div className="flex items-center gap-1 px-3 py-1.5 sticky top-0 z-10" style={{
                background: 'rgba(10,10,15,0.95)',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                backdropFilter: 'blur(8px)',
              }}>
                <span className="w-5 text-center text-[7px] font-mono" style={{ color: 'rgba(255,255,255,0.15)' }}>✓</span>
                <span className="flex-1 text-[7px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>BIOMARKER</span>
                <span className="w-20 text-right text-[7px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>VALUE</span>
                <span className="w-14 text-center text-[7px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.2)' }}>STATUS</span>
              </div>

              {filteredMarkers.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: m.isIncluded ? 1 : 0.35, x: 0 }}
                  transition={{ delay: i * 0.015, duration: 0.15 }}
                  className="flex items-center gap-1 px-3 py-1.5 transition-colors hover:bg-white/[0.02] group"
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.02)',
                    background: m.isModified ? 'rgba(0,242,255,0.02)' : 'transparent',
                  }}
                >
                  {/* Include toggle */}
                  <button
                    onClick={() => toggleMarker(m.id)}
                    className="w-5 h-5 flex items-center justify-center flex-shrink-0 rounded transition-all"
                    style={{
                      background: m.isIncluded ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${m.isIncluded ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    {m.isIncluded && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>

                  {/* Name + vault badge */}
                  <div className="flex-1 min-w-0 flex items-center gap-1.5">
                    <span className="text-[8px]">{CATEGORY_ICONS[m.category] || '🔬'}</span>
                    <span className="text-[9px] font-mono truncate" style={{ color: m.isIncluded ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.2)' }}>
                      {m.name}
                    </span>
                    {m.vaultKey && (
                      <span className="text-[6px] font-mono px-1 py-0.5 rounded flex-shrink-0" style={{
                        background: 'rgba(0,242,255,0.06)',
                        color: 'rgba(0,242,255,0.5)',
                        border: '1px solid rgba(0,242,255,0.1)',
                      }}>
                        VAULT
                      </span>
                    )}
                  </div>

                  {/* Value (editable) */}
                  <div className="w-20 flex items-center justify-end">
                    {m.isEditing ? (
                      <div className="flex items-center gap-0.5">
                        <input
                          type="number"
                          value={m.editValue}
                          onChange={(e) => setMarkers(prev => prev.map(x => x.id === m.id ? { ...x, editValue: e.target.value } : x))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmEdit(m.id);
                            if (e.key === 'Escape') cancelEdit(m.id);
                          }}
                          autoFocus
                          className="w-14 text-[9px] font-mono text-right px-1 py-0.5 rounded outline-none"
                          style={{
                            background: 'rgba(0,242,255,0.1)',
                            border: '1px solid rgba(0,242,255,0.3)',
                            color: 'rgba(0,242,255,0.9)',
                          }}
                        />
                        <button onClick={() => confirmEdit(m.id)} className="w-4 h-4 flex items-center justify-center rounded hover:bg-white/[0.05]">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(m.id)}
                        className="text-[9px] font-mono font-semibold text-right cursor-pointer hover:underline transition-colors"
                        style={{ color: m.isModified ? 'rgba(0,242,255,0.9)' : `${statusColor(m.status)}CC` }}
                        title="Click to edit"
                      >
                        {m.value}{' '}
                        <span className="text-[7px] font-normal" style={{ color: 'rgba(255,255,255,0.2)' }}>{m.unit}</span>
                      </button>
                    )}
                  </div>

                  {/* Status badge */}
                  <span className="w-14 text-center">
                    <span className="text-[7px] font-mono uppercase px-1.5 py-0.5 rounded" style={{
                      background: `${statusColor(m.status)}10`,
                      color: `${statusColor(m.status)}99`,
                      border: `1px solid ${statusColor(m.status)}20`,
                    }}>
                      {statusBadge(m.status)}
                    </span>
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Vault mapping preview */}
            {vaultMappedCount > 0 && (
              <div className="mt-2 px-2 py-2 rounded-lg" style={{
                background: 'rgba(0,242,255,0.02)',
                border: '1px solid rgba(0,242,255,0.08)',
              }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(0,242,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                  <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: 'rgba(0,242,255,0.6)' }}>
                    BIO-PROJECTION IMPACT
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {markers.filter(m => m.isIncluded && m.vaultKey).map(m => (
                    <span key={m.id} className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{
                      background: m.status === 'optimal' ? 'rgba(52,211,153,0.06)' : m.status === 'warning' ? 'rgba(255,214,10,0.06)' : 'rgba(255,69,58,0.06)',
                      color: `${statusColor(m.status)}88`,
                      border: `1px solid ${statusColor(m.status)}15`,
                    }}>
                      {m.name} → {m.value} {m.unit}
                    </span>
                  ))}
                </div>
                <span className="text-[7px] font-mono mt-1.5 block" style={{ color: 'rgba(0,242,255,0.3)' }}>
                  {vaultMappedCount} marker{vaultMappedCount !== 1 ? 's' : ''} will update Bio-Projection &amp; longevity forecast
                </span>
              </div>
            )}

            {/* Unmatched lines warning */}
            {unmatchedLines.length > 0 && (
              <div className="mt-2 px-2 py-1.5 rounded-lg" style={{
                background: 'rgba(245,158,11,0.03)',
                border: '1px solid rgba(245,158,11,0.08)',
              }}>
                <span className="text-[8px] font-mono" style={{ color: 'rgba(245,158,11,0.5)' }}>
                  {unmatchedLines.length} line{unmatchedLines.length !== 1 ? 's' : ''} could not be parsed
                </span>
              </div>
            )}

            {/* Commit button */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
                {includedCount} included &middot; {vaultMappedCount} mapped to vault
              </span>
              <button
                onClick={handleCommit}
                disabled={includedCount === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,242,255,0.12), rgba(52,211,153,0.12))',
                  border: '1px solid rgba(0,242,255,0.25)',
                  color: 'rgba(0,242,255,0.9)',
                  boxShadow: '0 0 16px rgba(0,242,255,0.08)',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                SYNC TO VAULT
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══ COMMITTING PHASE ═══ */}
        {phase === 'committing' && (
          <motion.div
            key="committing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl py-8 flex flex-col items-center"
            style={{
              background: 'rgba(0,242,255,0.02)',
              border: '1px solid rgba(0,242,255,0.1)',
            }}
          >
            <motion.div
              className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
              style={{
                background: 'rgba(52,211,153,0.08)',
                border: '1px solid rgba(52,211,153,0.2)',
                boxShadow: '0 0 24px rgba(52,211,153,0.1)',
              }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </motion.div>
            <span className="text-[11px] font-bold tracking-wide" style={{ color: 'rgba(52,211,153,0.9)' }}>
              SYNCING TO BIO-VAULT
            </span>
            <span className="text-[9px] font-mono mt-1 mb-3" style={{ color: 'rgba(52,211,153,0.5)' }}>
              Updating {includedCount} biomarkers &amp; recalculating forecast...
            </span>
            <div className="w-40 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #00F2FF, #34D399)',
                  boxShadow: '0 0 8px rgba(0,242,255,0.4)',
                  width: `${commitProgress}%`,
                }}
              />
            </div>
            <span className="text-[8px] font-mono mt-2" style={{ color: 'rgba(52,211,153,0.4)' }}>
              {commitProgress}%
            </span>
          </motion.div>
        )}

        {/* ═══ COMPLETE PHASE ═══ */}
        {phase === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl py-5 px-4"
            style={{
              background: 'rgba(52,211,153,0.03)',
              border: '1px solid rgba(52,211,153,0.15)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'rgba(52,211,153,0.1)',
                    border: '1px solid rgba(52,211,153,0.25)',
                    boxShadow: '0 0 16px rgba(52,211,153,0.15)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </motion.div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold tracking-wide" style={{ color: 'rgba(52,211,153,0.9)' }}>
                    QUICK-SYNC COMPLETE
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: 'rgba(52,211,153,0.5)' }}>
                    {includedCount} BIOMARKERS &middot; {vaultMappedCount} VAULT KEYS &middot; FORECAST UPDATED
                  </span>
                </div>
              </div>
              <button
                onClick={() => { handleReset(); onComplete?.(); }}
                className="text-[8px] font-mono uppercase tracking-wider px-2 py-1 rounded transition-all hover:bg-white/[0.04]"
                style={{ color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                NEW SYNC
              </button>
            </div>

            {/* Synced markers summary */}
            <div className="flex flex-wrap gap-1 mb-2">
              {markers.filter(m => m.isIncluded && m.vaultKey).map(m => (
                <span key={m.id} className="text-[8px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1" style={{
                  background: `${statusColor(m.status)}08`,
                  color: `${statusColor(m.status)}88`,
                  border: `1px solid ${statusColor(m.status)}15`,
                }}>
                  <span className="text-[7px]">{CATEGORY_ICONS[m.category]}</span>
                  {m.name}: {m.value} {m.unit}
                </span>
              ))}
            </div>

            {/* Forecast recalculation indicator */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{
              background: 'rgba(0,242,255,0.03)',
              border: '1px solid rgba(0,242,255,0.08)',
            }}>
              <motion.div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: '#00F2FF', boxShadow: '0 0 6px rgba(0,242,255,0.5)' }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-[9px] font-mono" style={{ color: 'rgba(0,242,255,0.6)' }}>
                BIO-PROJECTION RECALCULATING &middot; LONGEVITY FORECAST UPDATING
              </span>
            </div>

            {/* Flagged markers alert */}
            {flaggedCount > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {markers.filter(m => m.isIncluded && m.status !== 'optimal').map(m => (
                  <span key={m.id} className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{
                    background: m.status === 'critical' ? 'rgba(255,69,58,0.06)' : 'rgba(255,214,10,0.06)',
                    color: m.status === 'critical' ? 'rgba(255,69,58,0.7)' : 'rgba(255,214,10,0.7)',
                    border: `1px solid ${m.status === 'critical' ? 'rgba(255,69,58,0.12)' : 'rgba(255,214,10,0.12)'}`,
                  }}>
                    ⚠ {m.name}: {m.value} {m.unit}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ═══ ERROR PHASE ═══ */}
        {phase === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-xl py-6 px-4 flex flex-col items-center"
            style={{
              background: 'rgba(255,69,58,0.03)',
              border: '1px solid rgba(255,69,58,0.15)',
            }}
          >
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-2" style={{
              background: 'rgba(255,69,58,0.08)',
              border: '1px solid rgba(255,69,58,0.2)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF453A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <span className="text-[11px] font-bold tracking-wide mb-1" style={{ color: 'rgba(255,69,58,0.9)' }}>
              SYNC FAILED
            </span>
            <span className="text-[9px] font-mono mb-3 text-center max-w-[250px]" style={{ color: 'rgba(255,69,58,0.5)' }}>
              {errorMsg}
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="text-[9px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all hover:bg-white/[0.04]"
                style={{ color: 'rgba(0,242,255,0.7)', border: '1px solid rgba(0,242,255,0.2)' }}
              >
                TRY AGAIN
              </button>
              {markers.length > 0 && (
                <button
                  onClick={() => setPhase('verify')}
                  className="text-[9px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all"
                  style={{
                    background: 'rgba(52,211,153,0.08)',
                    color: 'rgba(52,211,153,0.7)',
                    border: '1px solid rgba(52,211,153,0.15)',
                  }}
                >
                  BACK TO VERIFY
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default QuickSync;
