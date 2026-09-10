import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';
import {
  type ClassifiedMarker,
  classifyAllMarkers,
  extractTextFromFile,
} from '../lib/LabResultParser';

/* ═══════════════════════════════════════════════════════════════
   LAB SCANNER — Longevity-First Blood Panel Intelligence
   
   Upload PDF/photo → AI OCR parse → Longevity classification table
   Flags markers "Sub-Optimal for Longevity" even when clinically normal.
   Displays a Longevity Insight summary with protocol adjustments.
   ═══════════════════════════════════════════════════════════════ */

type ScanPhase = 'idle' | 'reading' | 'parsing' | 'classifying' | 'complete' | 'error';

interface LabScannerProps {
  sessionId: string;
}

const PHASE_LABELS: Record<ScanPhase, string> = {
  idle: 'Ready to scan',
  reading: 'Extracting text from document...',
  parsing: 'AI Brain analyzing biomarkers...',
  classifying: 'Applying longevity-optimal ranges...',
  complete: 'Analysis complete',
  error: 'Scan failed',
};

const CATEGORY_ICONS: Record<string, string> = {
  metabolic: '⚡', hormonal: '🧬', inflammatory: '🛡️',
  nutrient: '☀️', lipid: '❤️', thyroid: '🦋', hematologic: '🩸',
};

export function LabScanner({ sessionId }: LabScannerProps) {
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<ReturnType<typeof classifyAllMarkers> | null>(null);
  const [insightSummary, setInsightSummary] = useState('');
  const [expandedMarker, setExpandedMarker] = useState<string | null>(null);
  const [committed, setCommitted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const saveBiomarkers = useMutation(api.vaultFiles.saveBiomarkersFromLab);
  const parseBiomarkers = useAction(api.ai.parseBiomarkers);

  const processFile = useCallback(async (file: File) => {
    setPhase('reading');
    setFileName(file.name);
    setError('');
    setResults(null);
    setInsightSummary('');
    setCommitted(false);
    setExpandedMarker(null);

    try {
      // Step 1: Extract text
      const text = await extractTextFromFile(file);
      if (!text || text.length < 20) {
        throw new Error('Could not extract readable text from this file. Try a text-based PDF or a clear photo.');
      }

      // Step 2: AI parse
      setPhase('parsing');
      let parsed: Record<string, number | null>;
      try {
        const aiResult = await parseBiomarkers({ fileName: file.name, rawText: text });
        parsed = (aiResult as any)?.biomarkers ?? aiResult ?? {};
      } catch {
        // Fallback: try regex extraction from text
        parsed = extractNumbersFromText(text);
      }

      // Step 3: Classify against longevity ranges
      setPhase('classifying');
      const numericMarkers: Record<string, number | null> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number') numericMarkers[k] = v;
      }

      const classified = classifyAllMarkers(numericMarkers);
      setResults(classified);

      // Generate insight summary
      const subCount = classified.subOptimal.length;
      const outCount = classified.outOfRange.length;
      const optCount = classified.optimal.length;
      const total = classified.all.length;

      if (total === 0) {
        setInsightSummary('No recognizable biomarkers were extracted. Try uploading a clearer lab report from Quest, Labcorp, or similar providers.');
      } else if (outCount > 0) {
        const worst = classified.outOfRange[0];
        setInsightSummary(
          `${outCount} marker${outCount > 1 ? 's' : ''} outside clinical range and ${subCount} sub-optimal for longevity out of ${total} analyzed. Priority: ${worst.label} at ${worst.value} ${worst.unit} — ${worst.suggestion.split('.')[0]}.`
        );
      } else if (subCount > 0) {
        const top = classified.subOptimal[0];
        setInsightSummary(
          `All ${total} markers within clinical range, but ${subCount} are sub-optimal for longevity. Top target: ${top.label} at ${top.value} ${top.unit} — clinically "normal" but below the threshold for cellular optimization.`
        );
      } else {
        setInsightSummary(
          `All ${total} biomarkers are within longevity-optimal range. Your biological systems are well-calibrated — maintain current protocol architecture.`
        );
      }

      // Auto-save to vault
      try {
        await saveBiomarkers({
          sessionId,
          fileName: file.name,
          fileSize: file.size,
          biomarkers: numericMarkers as any,
          analytesCount: total,
        });
        setCommitted(true);
      } catch (e) {
        console.warn('Auto-save to vault failed:', e);
      }

      setPhase('complete');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to process lab report');
      setPhase('error');
    }
  }, [sessionId, parseBiomarkers, saveBiomarkers]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const isProcessing = phase === 'reading' || phase === 'parsing' || phase === 'classifying';

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      {(phase === 'idle' || phase === 'error') && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-xl p-6 flex flex-col items-center gap-3 transition-all duration-300"
            style={{
              background: dragOver
                ? 'linear-gradient(135deg, rgba(0,242,255,0.08), rgba(168,85,247,0.06))'
                : 'rgba(255,255,255,0.02)',
              border: `1.5px dashed ${dragOver ? 'rgba(0,242,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
              boxShadow: dragOver ? '0 0 24px rgba(0,242,255,0.08), inset 0 0 16px rgba(0,242,255,0.04)' : 'none',
            }}
          >
            <motion.div
              animate={dragOver ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(0,242,255,0.1), rgba(168,85,247,0.08))',
                border: '1px solid rgba(0,242,255,0.15)',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(0,242,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </motion.div>
            <div className="text-center">
              <p className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Upload Lab Report
              </p>
              <p className="text-[10px] font-mono mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                PDF, TXT, or CSV from Quest, Labcorp, etc.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {['PDF', 'TXT', 'CSV'].map(ext => (
                <span key={ext} className="text-[9px] font-mono px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(0,242,255,0.06)', border: '1px solid rgba(0,242,255,0.1)', color: 'rgba(0,242,255,0.5)' }}>
                  .{ext}
                </span>
              ))}
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.heic" className="hidden" onChange={handleFileSelect} />

          {phase === 'error' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 rounded-lg p-3"
              style={{ background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.15)' }}>
              <p className="text-[11px]" style={{ color: '#FF453A' }}>{error}</p>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Processing Animation */}
      {isProcessing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl p-5"
          style={{ background: 'rgba(0,242,255,0.03)', border: '1px solid rgba(0,242,255,0.08)' }}>
          <div className="flex items-center gap-3 mb-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(0,242,255,0.15), rgba(168,85,247,0.1))', border: '1px solid rgba(0,242,255,0.2)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00F2FF" strokeWidth="2" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </motion.div>
            <div>
              <p className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Scanning {fileName}
              </p>
              <p className="text-[10px] font-mono" style={{ color: 'rgba(0,242,255,0.5)' }}>
                {PHASE_LABELS[phase]}
              </p>
            </div>
          </div>
          {/* Progress steps */}
          <div className="space-y-2">
            {(['reading', 'parsing', 'classifying'] as const).map((step, idx) => {
              const isActive = step === phase;
              const isDone = ['reading', 'parsing', 'classifying'].indexOf(phase) > idx;
              return (
                <div key={step} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                    style={{
                      background: isDone ? 'rgba(52,199,89,0.15)' : isActive ? 'rgba(0,242,255,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isDone ? 'rgba(52,199,89,0.3)' : isActive ? 'rgba(0,242,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                      color: isDone ? '#34C759' : isActive ? '#00F2FF' : 'rgba(255,255,255,0.2)',
                    }}>
                    {isDone ? '✓' : idx + 1}
                  </div>
                  <span className="text-[11px] font-mono" style={{
                    color: isDone ? 'rgba(52,199,89,0.7)' : isActive ? 'rgba(0,242,255,0.8)' : 'rgba(255,255,255,0.25)',
                  }}>
                    {step === 'reading' ? 'Text Extraction' : step === 'parsing' ? 'AI Biomarker Parse' : 'Longevity Classification'}
                  </span>
                  {isActive && (
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full" style={{ background: '#00F2FF' }} />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Results */}
      {phase === 'complete' && results && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {/* Longevity Insight Summary */}
          <div className="rounded-xl p-4" style={{
            background: results.outOfRange.length > 0
              ? 'linear-gradient(135deg, rgba(255,69,58,0.06), rgba(255,159,10,0.04))'
              : results.subOptimal.length > 0
                ? 'linear-gradient(135deg, rgba(255,159,10,0.06), rgba(0,242,255,0.03))'
                : 'linear-gradient(135deg, rgba(52,199,89,0.06), rgba(0,242,255,0.03))',
            border: `1px solid ${results.outOfRange.length > 0 ? 'rgba(255,69,58,0.12)' : results.subOptimal.length > 0 ? 'rgba(255,159,10,0.12)' : 'rgba(52,199,89,0.12)'}`,
          }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[14px]">
                {results.outOfRange.length > 0 ? '🔴' : results.subOptimal.length > 0 ? '🟡' : '🟢'}
              </span>
              <span className="text-[11px] font-mono font-bold uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Longevity Insight
              </span>
              {committed && (
                <span className="ml-auto text-[9px] font-mono px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(52,199,89,0.1)', border: '1px solid rgba(52,199,89,0.2)', color: '#34C759' }}>
                  Synced to Vault
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {insightSummary}
            </p>
          </div>

          {/* Score Pills */}
          <div className="flex gap-2">
            {[
              { label: 'Optimal', count: results.optimal.length, color: '#34C759', bg: 'rgba(52,199,89,0.08)' },
              { label: 'Sub-Optimal', count: results.subOptimal.length, color: '#FF9F0A', bg: 'rgba(255,159,10,0.08)' },
              { label: 'Flagged', count: results.outOfRange.length, color: '#FF453A', bg: 'rgba(255,69,58,0.08)' },
            ].map(pill => (
              <div key={pill.label} className="flex-1 rounded-lg py-2 px-3 text-center"
                style={{ background: pill.bg, border: `1px solid ${pill.color}20` }}>
                <div className="text-[18px] font-bold" style={{ color: pill.color }}>{pill.count}</div>
                <div className="text-[9px] font-mono uppercase tracking-wider" style={{ color: `${pill.color}99` }}>{pill.label}</div>
              </div>
            ))}
          </div>

          {/* Results Table */}
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto briefing-room-scroll">
            {/* Sub-optimal markers first (the key differentiator) */}
            {results.subOptimal.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#FF9F0A' }} />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em]" style={{ color: '#FF9F0A' }}>
                    Sub-Optimal for Longevity
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,159,10,0.1)' }} />
                </div>
                {results.subOptimal.map((m, idx) => (
                  <MarkerRow key={m.key} marker={m} index={idx} expanded={expandedMarker === m.key}
                    onToggle={() => setExpandedMarker(expandedMarker === m.key ? null : m.key)} />
                ))}
              </div>
            )}

            {/* Out of range */}
            {results.outOfRange.length > 0 && (
              <div className="mb-2">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#FF453A' }} />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em]" style={{ color: '#FF453A' }}>
                    Outside Clinical Range
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,69,58,0.1)' }} />
                </div>
                {results.outOfRange.map((m, idx) => (
                  <MarkerRow key={m.key} marker={m} index={idx} expanded={expandedMarker === m.key}
                    onToggle={() => setExpandedMarker(expandedMarker === m.key ? null : m.key)} />
                ))}
              </div>
            )}

            {/* Optimal */}
            {results.optimal.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#34C759' }} />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em]" style={{ color: '#34C759' }}>
                    Longevity Optimal
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(52,199,89,0.1)' }} />
                </div>
                {results.optimal.map((m, idx) => (
                  <MarkerRow key={m.key} marker={m} index={idx} expanded={expandedMarker === m.key}
                    onToggle={() => setExpandedMarker(expandedMarker === m.key ? null : m.key)} />
                ))}
              </div>
            )}
          </div>

          {/* Scan Another */}
          <button
            onClick={() => { setPhase('idle'); setResults(null); }}
            className="w-full py-2.5 rounded-xl text-[11px] font-mono font-medium tracking-wide transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            Scan Another Report
          </button>
        </motion.div>
      )}
    </div>
  );
}

/* ── Marker Row Component ── */

function MarkerRow({ marker, index, expanded, onToggle }: {
  marker: ClassifiedMarker; index: number; expanded: boolean; onToggle: () => void;
}) {
  const statusColors = { green: '#34C759', amber: '#FF9F0A', red: '#FF453A' };
  const color = statusColors[marker.severity];
  const icon = CATEGORY_ICONS[marker.category] ?? '📊';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="rounded-lg overflow-hidden mb-1.5"
      style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.04)` }}
    >
      <button onClick={onToggle} className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left">
        <span className="text-[12px]">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {marker.label}
            </span>
            {marker.classification === 'clinically-normal' && (
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: 'rgba(255,159,10,0.1)', border: '1px solid rgba(255,159,10,0.2)', color: '#FF9F0A' }}>
                CLINICALLY NORMAL
              </span>
            )}
          </div>
          {marker.delta && (
            <span className="text-[9px] font-mono" style={{ color: `${color}99` }}>
              {marker.delta}
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[14px] font-bold" style={{ color }}>{marker.value}</div>
          <div className="text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>{marker.unit}</div>
        </div>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2">
              <div className="h-px" style={{ background: 'rgba(255,255,255,0.04)' }} />
              {/* Range comparison */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="text-[8px] font-mono uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Clinical Range
                  </div>
                  <div className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {marker.clinicalRange}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-[8px] font-mono uppercase tracking-wider mb-0.5" style={{ color: 'rgba(0,242,255,0.4)' }}>
                    Longevity Optimal
                  </div>
                  <div className="text-[10px] font-mono" style={{ color: 'rgba(0,242,255,0.7)' }}>
                    {marker.optimalRange}
                  </div>
                </div>
              </div>
              {/* Suggestion */}
              <div className="rounded-lg p-2.5" style={{ background: `${color}08`, border: `1px solid ${color}15` }}>
                <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {marker.suggestion}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Fallback regex extraction when AI is unavailable ── */

function extractNumbersFromText(text: string): Record<string, number | null> {
  const result: Record<string, number | null> = {};
  const patterns: Array<{ key: string; regex: RegExp }> = [
    { key: 'vitaminD', regex: /vitamin\s*d[^0-9]*(\d+\.?\d*)/i },
    { key: 'ferritin', regex: /ferritin[^0-9]*(\d+\.?\d*)/i },
    { key: 'crp', regex: /(?:hs-?)?c[\s-]?reactive[^0-9]*(\d+\.?\d*)/i },
    { key: 'hba1c', regex: /(?:hba1c|hemoglobin\s*a1c|a1c)[^0-9]*(\d+\.?\d*)/i },
    { key: 'testosteroneTotal', regex: /(?:total\s+)?testosterone[^0-9]*(\d+\.?\d*)/i },
    { key: 'glucose', regex: /(?:fasting\s+)?glucose[^0-9]*(\d+\.?\d*)/i },
    { key: 'insulin', regex: /(?:fasting\s+)?insulin[^0-9]*(\d+\.?\d*)/i },
    { key: 'tsh', regex: /tsh[^0-9]*(\d+\.?\d*)/i },
    { key: 'hdl', regex: /hdl[^0-9]*(\d+\.?\d*)/i },
    { key: 'ldl', regex: /ldl[^0-9]*(\d+\.?\d*)/i },
    { key: 'triglycerides', regex: /triglyceride[^0-9]*(\d+\.?\d*)/i },
    { key: 'b12', regex: /(?:vitamin\s*)?b[\s-]?12[^0-9]*(\d+\.?\d*)/i },
    { key: 'iron', regex: /iron[^0-9]*(\d+\.?\d*)/i },
    { key: 'hemoglobin', regex: /hemoglobin[^0-9]*(\d+\.?\d*)/i },
    { key: 'homocysteine', regex: /homocysteine[^0-9]*(\d+\.?\d*)/i },
  ];

  for (const { key, regex } of patterns) {
    const match = text.match(regex);
    if (match?.[1]) {
      const val = parseFloat(match[1]);
      if (!isNaN(val) && val > 0) result[key] = val;
    }
  }
  return result;
}
